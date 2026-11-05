import type { AgreedBattle } from "../../../domain/battle/saved-battle.ts"
import type { LocalPetState } from "../../../domain/pet/progress.ts"
import { resultOf, TRADE_LOCK_KEY } from "../../persistence/database.ts"
import {
  assertContext,
  BATTLE_INTENT_KEY,
  type OnlineContext,
  onlineTransaction,
  sameContext,
} from "../../persistence/online-store.ts"
import { settleBattle } from "../../persistence/pet-store.ts"
import { api, onlineConfigured, onlineContext } from "../../platform/online-api.ts"

type Intent = { channel: string; battle: AgreedBattle; local: LocalPetState; context: OnlineContext; digest: string }
let expiryTimer: number | undefined
export const prepareOnlineBattle = async (
  channel: string,
  battle: AgreedBattle,
  local: LocalPetState,
  context: OnlineContext,
): Promise<void> => {
  if (!context.accountId) throw new Error("online.signIn")
  const text = JSON.stringify([
    battle.version,
    battle.battleId,
    battle.challenger,
    battle.receiver,
    battle.plan,
    battle.seed,
  ])
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("")
  const intent: Intent = { channel, battle, local, context, digest }
  await onlineTransaction(async (store) => {
    await assertContext(store, context)
    if ((await resultOf(store.get(TRADE_LOCK_KEY))) || (await resultOf(store.get("pending-battle"))))
      throw new Error("social.busy")
    const previous = await resultOf<Intent | undefined>(store.get(BATTLE_INTENT_KEY))
    if (previous && previous.channel !== channel) throw new Error("social.busy")
    store.put(intent, BATTLE_INTENT_KEY)
  })
  await api("/api/v1/me/battle-decision", "POST", { channel, destination: context, digest }, context.accountId)
}
/** A lost socket/HTTP response cannot turn a committed battle into a local cancellation. */
export const recoverOnlineBattle = async (): Promise<boolean> => {
  if (!onlineConfigured()) return false
  const intent = await onlineTransaction((store) => resultOf<Intent | undefined>(store.get(BATTLE_INTENT_KEY)))
  if (!intent) return false
  const context = await onlineContext()
  if (!sameContext(context, intent.context)) throw new Error("online.saveChanged")
  const decision = await api<{ state: string; expiresAt?: number }>(
    "/api/v1/me/battle-decision",
    "POST",
    { channel: intent.channel, destination: context, digest: intent.digest },
    context.accountId,
  )
  window.clearTimeout(expiryTimer)
  if (decision.state === "pending") {
    // One deadline for an actual pending operation, never a background polling loop.
    expiryTimer = window.setTimeout(
      () => window.dispatchEvent(new Event("digital-pet:battle-recover")),
      Math.max(100, (decision.expiresAt ?? Date.now() + 120_000) - Date.now() + 100),
    )
    return true
  }
  if (decision.state === "committed") await settleBattle(intent.battle, intent.local, context)
  else if (decision.state !== "canceled") throw new Error("online.invalid")
  await onlineTransaction(async (store) => {
    await assertContext(store, context)
    const current = await resultOf<Intent | undefined>(store.get(BATTLE_INTENT_KEY))
    if (current?.channel === intent.channel) store.delete(BATTLE_INTENT_KEY)
  })
  return false
}
