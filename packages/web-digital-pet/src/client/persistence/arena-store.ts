import { arenaEligible, arenaPartner, arenaSnapshot } from "../../domain/battle/arena.ts"
import type { LocalPetState } from "../../domain/pet/progress.ts"
import { IntlModule } from "../../shared/i18n.ts"
import { assertNoExchange, completed, openDatabase, resultOf } from "./database.ts"
import { readLocalState } from "./pet-store.ts"

export const readArenaFighter = async (state?: LocalPetState): Promise<LocalPetState> => {
  const team = state ?? (await readLocalState())
  const database = await openDatabase()
  try {
    const transaction = database.transaction("pet", "readonly")
    const selected = await resultOf<unknown>(transaction.objectStore("pet").get("arena-partner"))
    return arenaSnapshot(team, arenaPartner(team, typeof selected === "string" ? selected : undefined))
  } finally {
    database.close()
  }
}

export const selectArenaFighter = async (partnerId: string): Promise<void> => {
  const database = await openDatabase()
  try {
    const transaction = database.transaction("pet", "readwrite")
    const done = completed(transaction)
    const store = transaction.objectStore("pet")
    await assertNoExchange(store)
    const state = await resultOf<LocalPetState | undefined>(store.get("current"))
    if (!state || (await resultOf(store.get("pending-battle")))) throw new Error(IntlModule.translate("social.busy"))
    const partner = arenaPartner(state, partnerId)
    if (partner.partnerId !== partnerId || !arenaEligible(partner))
      throw new Error(IntlModule.translate("social.noArenaEligible"))
    store.put(partnerId, "arena-partner")
    await done
  } finally {
    database.close()
  }
}
