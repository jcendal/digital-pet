import { isWorldVisit } from "@jcendal/digital-pet-fields/application/world.ts"
import type { WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import { rewardBattleWinner } from "../../domain/battle/reward.ts"
import { type AgreedBattle, type PendingBattle, parsePendingBattle } from "../../domain/battle/saved-battle.ts"
import {
  advanceLocalPet,
  beginNewPartner,
  cleanLocalPoop,
  completeLocalEvolution,
  consumeLocalFood,
  type ExperienceLevel,
  type LocalPetState,
} from "../../domain/pet/progress.ts"
import { IntlModule } from "../../shared/i18n.ts"

const DB_NAME = "web-digital-pet"
const STORE_NAME = "pet"
const STATE_KEY = "current"
const DEVICE_KEY = "device-code"
const BACKUP_KEY = "previous-save"
const PAIRED_KEY = "paired-device"
const PENDING_BATTLE_KEY = "pending-battle"
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Receipt, prize and recoverable playback are committed together before the first frame. */
export const settleBattle = async (
  battle: AgreedBattle,
  expected: LocalPetState,
): Promise<PendingBattle | undefined> => {
  const prepared = parsePendingBattle({ ...battle, completedShots: 0, rewarded: false, agreedAt: Date.now() })
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const key = `battle:${battle.battleId}`
    const receipt = await resultOf(store.get(key))
    const storedPending = await resultOf(store.get(PENDING_BATTLE_KEY))
    const pending = storedPending === undefined ? undefined : parsePendingBattle(storedPending)
    const state = (await resultOf(store.get(STATE_KEY))) as LocalPetState | undefined
    if (pending && pending.battleId !== battle.battleId)
      throw new Error(IntlModule.translate("controller.finishTheSavedBattleFirst"))
    const won = battle.plan.outcome === battle.localSide
    let rewarded = false
    let saved = pending
    if (!receipt) {
      if (state && won) {
        const next = rewardBattleWinner(state, expected, Date.now())
        rewarded = next !== state
        if (rewarded) store.put(next, STATE_KEY)
      }
      store.put({ won, settledAt: Date.now() }, key)
      saved = { ...prepared, rewarded }
      store.put(saved, PENDING_BATTLE_KEY)
    }
    await done
    return saved
  } finally {
    database.close()
  }
}

export const readPendingBattle = async (): Promise<PendingBattle | undefined> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const value = await resultOf(transaction.objectStore(STORE_NAME).get(PENDING_BATTLE_KEY))
    return value === undefined ? undefined : parsePendingBattle(value)
  } finally {
    database.close()
  }
}

const updatePendingBattle = async (
  battleId: string,
  change: (pending: PendingBattle) => PendingBattle | undefined,
): Promise<boolean> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const value = await resultOf(store.get(PENDING_BATTLE_KEY))
    const pending = value === undefined ? undefined : parsePendingBattle(value)
    if (!pending || pending.battleId !== battleId) {
      await done
      return false
    }
    const next = change(pending)
    if (next) store.put(next, PENDING_BATTLE_KEY)
    else store.delete(PENDING_BATTLE_KEY)
    await done
    return true
  } finally {
    database.close()
  }
}

export const checkpointBattle = (battleId: string, completedShots: number): Promise<boolean> =>
  updatePendingBattle(battleId, (pending) => {
    if (!Number.isInteger(completedShots) || completedShots < 0 || completedShots > pending.plan.shots.length)
      throw new Error(IntlModule.translate("petStore.invalidBattlePlaybackCheckpoint"))
    return { ...pending, completedShots: Math.max(pending.completedShots, completedShots) }
  })

/** Clear playback only after its outcome was shown; the reward receipt remains. */
export const finishPendingBattle = (battleId: string): Promise<boolean> =>
  updatePendingBattle(battleId, (pending) => {
    if (pending.completedShots !== pending.plan.shots.length)
      throw new Error(IntlModule.translate("petStore.theSavedBattleIsNotFinished"))
    return undefined
  })

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(IntlModule.translate("petStore.browserPetStorageIsBlocked")))
  })

const completed = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () =>
      reject(transaction.error ?? new Error(IntlModule.translate("petStore.browserPetStorageWasInterrupted")))
  })

const resultOf = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const initialState = (now: number): LocalPetState => {
  const createdAt = new Date(now).toISOString()
  return {
    partnerId: crypto.randomUUID(),
    createdAt,
    currentNodeId: "0-001",
    gauge: 0,
    isTerminal: false,
    lastTickAt: now,
    events: [{ currentNodeId: "0-001", createdAt }],
  }
}

export const readLocalState = async (): Promise<LocalPetState> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const stored = (await resultOf(store.get(STATE_KEY))) as LocalPetState | undefined
    const now = Date.now()
    const state = stored ? advanceLocalPet(stored, now) : initialState(now)
    if (state !== stored) store.put(state, STATE_KEY)
    await done
    return state
  } finally {
    database.close()
  }
}

/** Animation checkpoints inspect identity without advancing time or taking a write transaction. */
export const peekLocalState = async (): Promise<LocalPetState | undefined> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readonly")
    return await resultOf<LocalPetState | undefined>(transaction.objectStore(STORE_NAME).get(STATE_KEY))
  } finally {
    database.close()
  }
}

const newDeviceCode = (): string => {
  const random = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(random, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("")
}

export const getDeviceCode = async (): Promise<string> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const stored = (await resultOf(store.get(DEVICE_KEY))) as string | undefined
    const code = stored ?? newDeviceCode()
    if (!stored) store.put(code, DEVICE_KEY)
    await done
    return code
  } finally {
    database.close()
  }
}

export const hasPreviousSave = async (): Promise<boolean> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const previous = await resultOf(transaction.objectStore(STORE_NAME).get(BACKUP_KEY))
    return previous !== undefined
  } finally {
    database.close()
  }
}

export const replaceLocalState = async (incoming: LocalPetState): Promise<void> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const previous = (await resultOf(store.get(STATE_KEY))) as LocalPetState | undefined
    if (previous) store.put(previous, BACKUP_KEY)
    store.put(incoming, STATE_KEY)
    await done
  } finally {
    database.close()
  }
}

export const restorePreviousSave = async (): Promise<boolean> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const previous = (await resultOf(store.get(BACKUP_KEY))) as LocalPetState | undefined
    if (!previous) {
      await done
      return false
    }
    const current = (await resultOf(store.get(STATE_KEY))) as LocalPetState | undefined
    store.put(previous, STATE_KEY)
    if (current) store.put(current, BACKUP_KEY)
    await done
    return true
  } finally {
    database.close()
  }
}

const changeLocalState = async (change: (state: LocalPetState) => LocalPetState, backup = false): Promise<void> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const stored = (await resultOf(store.get(STATE_KEY))) as LocalPetState | undefined
    const state = advanceLocalPet(stored ?? initialState(Date.now()), Date.now())
    if (backup) store.put(state, BACKUP_KEY)
    store.put(change(state), STATE_KEY)
    await done
  } finally {
    database.close()
  }
}

export const setExperienceLevel = (level: ExperienceLevel): Promise<void> =>
  changeLocalState((state) => ({ ...state, experienceLevel: level }))

export const finishLocalEvolution = (expectedKey: string, won: boolean, active: () => boolean): Promise<void> =>
  changeLocalState((state) => (active() ? completeLocalEvolution(state, expectedKey, won, Date.now()) : state))

export const startNewPartner = (): Promise<void> =>
  changeLocalState((state) => beginNewPartner(state, crypto.randomUUID(), Date.now()), true)

export const cleanPoop = async (partnerId: string, poopId: number, active: () => boolean): Promise<boolean> => {
  let cleaned = false
  await changeLocalState((state) => {
    const next = active() ? cleanLocalPoop(state, partnerId, poopId, Date.now()) : state
    cleaned = next !== state
    return next
  })
  return cleaned
}

export const consumeFood = async (partnerId: string, active: () => boolean): Promise<boolean> => {
  let consumed = false
  await changeLocalState((state) => {
    const next = active() ? consumeLocalFood(state, partnerId, Date.now()) : state
    consumed = next !== state
    return next
  })
  return consumed
}

export const getPairedDevice = async (): Promise<string | null> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const value = await resultOf(transaction.objectStore(STORE_NAME).get(PAIRED_KEY))
    return typeof value === "string" ? value : null
  } finally {
    database.close()
  }
}

export const setPairedDevice = async (code: string | null): Promise<void> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    if (code === null) store.delete(PAIRED_KEY)
    else store.put(code, PAIRED_KEY)
    await done
  } finally {
    database.close()
  }
}

export const setWorldVisit = (worldVisit: WorldVisit): Promise<void> => {
  if (!isWorldVisit(worldVisit)) throw new Error(IntlModule.translate("petStore.unknownDestination"))
  return changeLocalState((state) => ({ ...state, worldVisit }))
}
