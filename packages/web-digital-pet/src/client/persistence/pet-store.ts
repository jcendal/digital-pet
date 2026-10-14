import type { AdventureStore } from "@jcendal/digital-pet-core/application/ports/adventure-store.ts"
import { isEggFamilyId } from "@jcendal/digital-pet-core/data/egg-families.ts"
import { adventureBusy, parseAdventure } from "@jcendal/digital-pet-core/domain/adventure.ts"
import { limitAdventureReadyAt } from "@jcendal/digital-pet-core/domain/adventure-pacing.ts"
import type { TeamCommand, TeamCommandOutcome } from "@jcendal/digital-pet-core/domain/partner-team.ts"
import { DEFAULT_WORLD_VISIT, isWorldVisit } from "@jcendal/digital-pet-fields/application/world.ts"
import { discoveredEggFamilies } from "@jcendal/digital-pet-fields/data/egg-discoveries.ts"
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
  experienceThresholds,
  type LocalPetState,
  pendingEvolutionKey,
  petLocalEgg,
  replaceLocalPartner,
} from "../../domain/pet/progress.ts"
import { applyLocalTeamCommand } from "../../domain/pet/team.ts"
import { IntlModule } from "../../shared/i18n.ts"

const DB_NAME = "web-digital-pet"
const STORE_NAME = "pet"
const STATE_KEY = "current"
const DEVICE_KEY = "device-code"
const BACKUP_KEY = "previous-save"
const PAIRED_KEY = "paired-device"
const PENDING_BATTLE_KEY = "pending-battle"
const ADVENTURE_KEY = "adventure"
const ADVENTURE_READY_KEY = "adventure-ready-at"
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Identity checks, rest clocks and adventure handoff share a single IndexedDB write. */
export const applyBrowserTeamCommand = async (
  command: TeamCommand,
  active: () => boolean = () => true,
  eggFamilyId?: string,
): Promise<TeamCommandOutcome> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const state = await resultOf<LocalPetState | undefined>(store.get(STATE_KEY))
    const pending = await resultOf(store.get(PENDING_BATTLE_KEY))
    const saved = await resultOf<{ partnerId: string; state: unknown } | undefined>(store.get(ADVENTURE_KEY))
    const adventure = saved && saved.partnerId === state?.partnerId ? parseAdventure(saved.state) : undefined
    if (!state || !active()) {
      await done
      return { kind: "rejected", reason: "busy" }
    }
    const now = Date.now()
    if (
      eggFamilyId !== undefined &&
      (command.kind !== "place" ||
        command.partner.currentNodeId !== "0-001" ||
        !isEggFamilyId(eggFamilyId) ||
        !discoveredEggFamilies(state.bossVictories ?? []).includes(eggFamilyId))
    ) {
      await done
      return { kind: "rejected", reason: "invalid_input" }
    }
    const changed = applyLocalTeamCommand(
      state,
      command,
      crypto.randomUUID(),
      now,
      Boolean(pending || adventureBusy(adventure)),
    )
    if (changed.outcome.kind === "applied") {
      let next = changed.state
      if (eggFamilyId) {
        if (command.kind === "place" && command.slot === "reserve" && next.reserve)
          next = { ...next, reserve: { ...next.reserve, originEggId: eggFamilyId } }
        else next = { ...next, originEggId: eggFamilyId }
      }
      if (command.kind === "switch") {
        if (next.reserve && adventure)
          next = { ...next, reserve: { ...next.reserve, adventure: { ...adventure, lastTickAt: now } } }
        const resumed = state.reserve?.adventure
        if (resumed) store.put({ partnerId: next.partnerId, state: { ...resumed, lastTickAt: now } }, ADVENTURE_KEY)
        else store.delete(ADVENTURE_KEY)
      } else if (command.slot === "principal") store.delete(ADVENTURE_KEY)
      store.put(next, STATE_KEY)
    } else if (changed.state !== state) store.put(changed.state, STATE_KEY)
    await done
    return changed.outcome
  } finally {
    database.close()
  }
}

export const readAdventureState = async () => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const saved = await resultOf<{ partnerId: string; state: unknown } | undefined>(store.get(ADVENTURE_KEY))
    const pet = await resultOf<LocalPetState | undefined>(store.get(STATE_KEY))
    const adventure = saved?.partnerId === pet?.partnerId ? parseAdventure(saved?.state) : undefined
    return adventure?.nodeId === pet?.currentNodeId ? adventure : undefined
  } finally {
    database.close()
  }
}

export const browserAdventureStore: AdventureStore = {
  async nextReadyAt() {
    const database = await openDatabase()
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      const done = completed(transaction)
      const store = transaction.objectStore(STORE_NAME)
      const saved = (await resultOf<number | undefined>(store.get(ADVENTURE_READY_KEY))) ?? 0
      const readyAt = limitAdventureReadyAt(saved, Date.now())
      if (readyAt !== saved) store.put(readyAt, ADVENTURE_READY_KEY)
      await done
      return readyAt
    } finally {
      database.close()
    }
  },
  async updateAdventure(change) {
    const database = await openDatabase()
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      const done = completed(transaction)
      const store = transaction.objectStore(STORE_NAME)
      const state = await resultOf<LocalPetState | undefined>(store.get(STATE_KEY))
      const saved = await resultOf<{ partnerId: string; state: unknown } | undefined>(store.get(ADVENTURE_KEY))
      const savedReadyAt = (await resultOf<number | undefined>(store.get(ADVENTURE_READY_KEY))) ?? 0
      const readyAt = limitAdventureReadyAt(savedReadyAt, Date.now())
      if (readyAt !== savedReadyAt) store.put(readyAt, ADVENTURE_READY_KEY)
      const battle = await resultOf(store.get(PENDING_BATTLE_KEY))
      if (!state) {
        await done
        return undefined
      }
      const adventure = saved?.partnerId === state.partnerId ? parseAdventure(saved.state) : undefined
      const next = change({
        partner: {
          ...state,
          generation: 0,
          retiredAt: null,
          pendingEvolutionTargetId: state.pendingEvolution?.targetNodeId ?? null,
          battleOpponentNodeId: state.pendingEvolution?.opponentNodeId ?? null,
        },
        adventure,
        readyAt,
        blocked: Boolean(battle || state.pendingEvolution),
        thresholds: experienceThresholds(state.experienceLevel),
        regionId: state.worldVisit?.regionId ?? DEFAULT_WORLD_VISIT.regionId,
        hygiene: state.hygiene,
      })
      if (next) {
        const victory = next.bossVictory
        let rewardedState =
          victory &&
          !state.bossVictories?.some((saved) => saved.regionId === victory.regionId && saved.nodeId === victory.nodeId)
            ? { ...state, bossVictories: [...(state.bossVictories ?? []), victory] }
            : state
        if (next.combatVictory)
          rewardedState = {
            ...rewardedState,
            combatVictories: Math.min(1_000_000, (rewardedState.combatVictories ?? 0) + 1),
          }
        if (rewardedState !== state) store.put(rewardedState, STATE_KEY)
        if (next.adventure !== adventure)
          store.put({ partnerId: state.partnerId, state: next.adventure }, ADVENTURE_KEY)
        if (next.readyAt !== undefined) store.put(next.readyAt, ADVENTURE_READY_KEY)
        if (next.replacement) {
          const input = next.replacement
          store.put(
            replaceLocalPartner(
              rewardedState,
              crypto.randomUUID(),
              Date.parse(input.createdAt),
              input.currentNodeId,
              input.isTerminal,
            ),
            STATE_KEY,
          )
        }
        const progress = next.progression
        if (progress) {
          const now = Date.now()
          store.put(
            {
              ...rewardedState,
              gauge: progress.gauge,
              isTerminal: progress.isTerminal,
              ...(progress.pendingEvolutionTargetId || progress.battleOpponentNodeId
                ? {
                    pendingEvolution: {
                      targetNodeId: progress.pendingEvolutionTargetId,
                      opponentNodeId: progress.battleOpponentNodeId,
                      readyAt: now,
                    },
                  }
                : {}),
            },
            STATE_KEY,
          )
        }
      }
      await done
      return next?.adventure
    } finally {
      database.close()
    }
  },
}

/** Save agreement and recoverable playback before the first frame; XP waits for the outcome. */
export const settleBattle = async (
  battle: AgreedBattle,
  expected: LocalPetState,
): Promise<PendingBattle | undefined> => {
  const prepared = parsePendingBattle({
    ...battle,
    completedShots: 0,
    rewarded: false,
    agreedAt: Date.now(),
    rewardTarget: {
      partnerId: expected.partnerId,
      currentNodeId: expected.currentNodeId,
      experienceLevel: expected.experienceLevel ?? "high",
    },
  })
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const key = `battle:${battle.battleId}`
    const receipt = await resultOf(store.get(key))
    const storedPending = await resultOf(store.get(PENDING_BATTLE_KEY))
    const pending = storedPending === undefined ? undefined : parsePendingBattle(storedPending)
    const adventure = await resultOf<{ partnerId: string; state: unknown } | undefined>(store.get(ADVENTURE_KEY))
    const trip = adventure?.partnerId === expected.partnerId ? parseAdventure(adventure?.state) : undefined
    if (adventureBusy(trip)) throw new Error(IntlModule.translate("adventure.finishFirst"))
    if (pending && pending.battleId !== battle.battleId)
      throw new Error(IntlModule.translate("controller.finishTheSavedBattleFirst"))
    const won = battle.plan.outcome === battle.localSide
    let saved = pending
    if (!receipt) {
      store.put({ won, settledAt: Date.now() }, key)
      saved = prepared
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

/** Award XP, record completion and clear playback atomically after the outcome was shown. */
export const finishPendingBattle = async (battleId: string): Promise<{ readonly rewarded: boolean } | undefined> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const value = await resultOf(store.get(PENDING_BATTLE_KEY))
    const pending = value === undefined ? undefined : parsePendingBattle(value)
    if (!pending || pending.battleId !== battleId) {
      await done
      return undefined
    }
    if (pending.completedShots !== pending.plan.shots.length)
      throw new Error(IntlModule.translate("petStore.theSavedBattleIsNotFinished"))
    const receiptKey = `battle:${battleId}`
    const receipt = await resultOf<{ won: boolean; settledAt: number; completedAt?: number } | undefined>(
      store.get(receiptKey),
    )
    const state = await resultOf<LocalPetState | undefined>(store.get(STATE_KEY))
    const won = pending.plan.outcome === pending.localSide
    const opponent = pending.localSide === "player" ? pending.receiver : pending.challenger
    const next =
      state && won && !pending.rewarded && pending.rewardTarget && receipt?.completedAt === undefined
        ? rewardBattleWinner(state, pending.rewardTarget, opponent.nodeId, Date.now())
        : state
    const rewarded = pending.rewarded || Boolean(state && next !== state)
    if (next !== state) store.put(next, STATE_KEY)
    store.put({ won, settledAt: receipt?.settledAt ?? pending.agreedAt, rewarded, completedAt: Date.now() }, receiptKey)
    store.delete(PENDING_BATTLE_KEY)
    await done
    return { rewarded }
  } finally {
    database.close()
  }
}

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
    originEggId: "starter",
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
    store.delete(ADVENTURE_KEY)
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
    store.delete(ADVENTURE_KEY)
    if (current) store.put(current, BACKUP_KEY)
    await done
    return true
  } finally {
    database.close()
  }
}

const changeLocalState = async (
  change: (state: LocalPetState) => LocalPetState,
  backup = false,
  care = false,
): Promise<void> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const stored = (await resultOf(store.get(STATE_KEY))) as LocalPetState | undefined
    const state = advanceLocalPet(stored ?? initialState(Date.now()), Date.now())
    if (care) {
      const saved = await resultOf<{ partnerId: string; state: unknown } | undefined>(store.get(ADVENTURE_KEY))
      const trip = saved?.partnerId === state.partnerId ? parseAdventure(saved.state) : undefined
      if (trip?.nodeId === state.currentNodeId && trip.status === "travel" && adventureBusy(trip)) {
        await done
        return
      }
    }
    if (backup) store.put(state, BACKUP_KEY)
    store.put(change(state), STATE_KEY)
    await done
  } finally {
    database.close()
  }
}

export const setExperienceLevel = (level: ExperienceLevel): Promise<void> =>
  changeLocalState((state) => ({ ...state, experienceLevel: level }))

export const finishLocalEvolution = async (
  expectedKey: string,
  won: boolean,
  active: () => boolean,
): Promise<{ accepted: boolean; targetNodeId: string | null; currentNodeId: string | null }> => {
  let result: { accepted: boolean; targetNodeId: string | null; currentNodeId: string | null } = {
    accepted: false,
    targetNodeId: null,
    currentNodeId: null,
  }
  await changeLocalState((state) => {
    if (!active() || pendingEvolutionKey(state) !== expectedKey) return state
    const next = completeLocalEvolution(state, expectedKey, won, Date.now())
    result = {
      accepted: true,
      targetNodeId: next.currentNodeId !== state.currentNodeId ? next.currentNodeId : null,
      currentNodeId: next.currentNodeId,
    }
    return next
  })
  return result
}

export const startNewPartner = (): Promise<void> =>
  changeLocalState((state) => beginNewPartner(state, crypto.randomUUID(), Date.now()), true)

export const petEgg = async (partnerId: string, interactionId: string, active: () => boolean): Promise<boolean> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const receiptKey = `egg:${interactionId}`
    const receipt = await resultOf(store.get(receiptKey))
    const battle = await resultOf(store.get(PENDING_BATTLE_KEY))
    const state = await resultOf<LocalPetState | undefined>(store.get(STATE_KEY))
    const next = state && active() && !receipt && !battle ? petLocalEgg(state, partnerId, Date.now()) : state
    const accepted = Boolean(state && next !== state)
    if (accepted) {
      store.put(next, STATE_KEY)
      store.put({ partnerId }, receiptKey)
    }
    await done
    return accepted
  } finally {
    database.close()
  }
}

export const cleanPoop = async (partnerId: string, poopId: number, active: () => boolean): Promise<boolean> => {
  let cleaned = false
  await changeLocalState(
    (state) => {
      const next = active() ? cleanLocalPoop(state, partnerId, poopId, Date.now()) : state
      cleaned = next !== state
      return next
    },
    false,
    true,
  )
  return cleaned
}

export const consumeFood = async (partnerId: string, active: () => boolean): Promise<boolean> => {
  let consumed = false
  await changeLocalState(
    (state) => {
      const next = active() ? consumeLocalFood(state, partnerId, Date.now()) : state
      consumed = next !== state
      return next
    },
    false,
    true,
  )
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
