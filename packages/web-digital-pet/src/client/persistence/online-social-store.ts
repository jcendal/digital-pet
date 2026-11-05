import { sameDestination } from "@jcendal/digital-pet-online/contracts.ts"
import type { OnlineGift, OnlineProfile, OnlineRelationship } from "@jcendal/digital-pet-online/social.ts"
import type { LocalPetState } from "../../domain/pet/progress.ts"
import { applyExchange } from "../../domain/social/exchange.ts"
import { addSocialLog, type Event, parseOffer, parseProfile, type Receipt } from "../../domain/social/model.ts"
import { resultOf, TRADE_LOCK_KEY } from "./database.ts"
import {
  assertContext,
  EFFECT_LOCK_KEY,
  type OnlineContext,
  onlineReceiptKey,
  onlineTransaction,
} from "./online-store.ts"
import { updateSocial } from "./social-store.ts"

export type GiftIntent = { id: string; pair: string; generation: number; context: OnlineContext }
export type AppliedAck = { kind: "gifts" | "trades"; id: string; pair: string }
const foodEligible = (state: LocalPetState | undefined): state is LocalPetState =>
  Boolean(state && !state.pendingEvolution && !state.currentNodeId.startsWith("0-") && state.food?.kind !== "available")
export const beginGiftClaim = (intent: GiftIntent): Promise<void> =>
  onlineTransaction(async (store) => {
    await assertContext(store, intent.context)
    const existing = await resultOf<GiftIntent | undefined>(store.get(EFFECT_LOCK_KEY))
    if (existing?.id === intent.id) return
    if (existing || (await resultOf(store.get(TRADE_LOCK_KEY)))) throw new Error("social.busy")
    const state = await resultOf<LocalPetState | undefined>(store.get("current"))
    if (!foodEligible(state)) throw new Error("social.foodPending")
    store.put(intent, EFFECT_LOCK_KEY)
  })
export const readGiftIntent = (): Promise<GiftIntent | undefined> =>
  onlineTransaction((store) => resultOf(store.get(EFFECT_LOCK_KEY)))
export const clearGiftIntent = (context: OnlineContext, id: string): Promise<void> =>
  onlineTransaction(async (store) => {
    await assertContext(store, context)
    const current = await resultOf<GiftIntent | undefined>(store.get(EFFECT_LOCK_KEY))
    if (current?.id === id) store.delete(EFFECT_LOCK_KEY)
  })
const applyGift = async (store: IDBObjectStore, context: OnlineContext, gift: OnlineGift): Promise<boolean> => {
  if (!gift.destination || !sameDestination(context, gift.destination)) return false
  const key = onlineReceiptKey(context, "gift", gift.id)
  if (await resultOf(store.get(key))) return true
  const state = await resultOf<LocalPetState | undefined>(store.get("current"))
  if (!foodEligible(state) || (await resultOf(store.get(TRADE_LOCK_KEY)))) return false
  store.put({ ...state, food: { kind: "available" } }, "current")
  store.put({ appliedAt: Date.now() }, key)
  const intent = await resultOf<GiftIntent | undefined>(store.get(EFFECT_LOCK_KEY))
  if (intent?.id === gift.id) store.delete(EFFECT_LOCK_KEY)
  return true
}

/** Canonical friendship bootstrap precedes effects; effects and receipts commit together. */
export const mergeOnlineRelationship = (
  context: OnlineContext,
  pairId: string,
  pair: OnlineRelationship,
  profile: OnlineProfile,
): Promise<AppliedAck[]> =>
  updateSocial(async (state, store) => {
    await assertContext(store, context)
    if (!context.accountId || !pair.members.includes(context.accountId) || !pair.members.includes(profile.id))
      throw new Error("social.invalid")
    const code = profile.code
    const display = parseProfile(profile)
    const acks: AppliedAck[] = []
    if (pair.active) state.friends[code] = { code, profile: display, confirmed: true }
    else {
      delete state.friends[code]
      for (const receipt of [...Object.values(state.inbox), ...Object.values(state.outbox)])
        if (receipt.code === code) receipt.state = "done"
    }
    const put = (id: string, sender: string, createdAt: number, event: Event, pending: boolean) => {
      const receipt: Receipt = { id, code, profile: display, createdAt, event, state: pending ? "pending" : "done" }
      if (sender === context.accountId) state.outbox[id] = { ...receipt, delivery: "delivered" }
      else state.inbox[id] = receipt
    }
    for (const invitation of pair.invitations)
      put(
        invitation.id,
        invitation.sender,
        invitation.createdAt,
        { kind: "invite" },
        invitation.state === "pending" && invitation.expiresAt > Date.now(),
      )
    for (const gift of pair.gifts) {
      const previous = state.inbox[gift.id]?.state
      put(
        gift.id,
        gift.sender,
        gift.createdAt,
        { kind: "gift", day: gift.day },
        pair.active && gift.state === "pending" && gift.expiresAt > Date.now(),
      )
      if (gift.sender === context.accountId)
        state.giftDays[code] = gift.day > (state.giftDays[code] ?? "") ? gift.day : (state.giftDays[code] ?? gift.day)
      if (gift.recipient === context.accountId && gift.state === "claimed" && !gift.applied) {
        if (await applyGift(store, context, gift)) {
          if (previous !== "done") addSocialLog(state, "giftCollected", display.alias)
          acks.push({ kind: "gifts", id: gift.id, pair: pairId })
        } else if (gift.destination && sameDestination(context, gift.destination)) {
          const receipt = state.inbox[gift.id]
          if (receipt) receipt.state = "pending"
        }
      }
    }
    for (const challenge of pair.challenges ?? []) {
      if (state.inbox[challenge.id]?.state === "done") continue
      put(
        challenge.id,
        challenge.sender,
        challenge.createdAt,
        { kind: "challenge", battleCode: challenge.battleCode },
        pair.active && challenge.expiresAt > Date.now(),
      )
    }
    const retainedIds = new Set(
      [...pair.invitations, ...pair.gifts, ...(pair.challenges ?? []), ...pair.trades].map((item) => item.id),
    )
    for (const receipt of Object.values(state.inbox))
      if (
        receipt.code === code &&
        !retainedIds.has(receipt.event.kind === "trade-ready" ? receipt.event.tradeId : receipt.id)
      )
        receipt.state = "done"
    for (const receipt of Object.values(state.outbox))
      if (
        receipt.code === code &&
        receipt.delivery === "delivered" &&
        !retainedIds.has(receipt.event.kind === "trade-ready" ? receipt.event.tradeId : receipt.id)
      )
        receipt.state = "done"
    const serverIds = new Set(pair.trades.map((trade) => trade.id))
    for (const trade of pair.trades) {
      const initiator = Object.keys(trade.sides)[0]
      if (!initiator) continue
      const initial = trade.sides[initiator]
      if (!initial) continue
      const pending = pair.active && trade.state === "pending" && trade.expiresAt > Date.now()
      put(trade.id, initiator, trade.createdAt, { kind: "trade-offer", offer: parseOffer(initial.offer) }, pending)
      const responder = pair.members.find((member) => member !== initiator)
      if (responder && trade.sides[responder])
        put(
          `${trade.id}-ready`,
          responder,
          trade.createdAt,
          { kind: "trade-ready", tradeId: trade.id, offer: parseOffer(trade.sides[responder].offer) },
          pending,
        )
      const side = trade.sides[context.accountId]
      const local = state.trades[trade.id]
      if (trade.state === "committed" && side && sameDestination(side.destination, context)) {
        const key = onlineReceiptKey(context, "trade", trade.id)
        if (!(await resultOf(store.get(key)))) {
          if (!local || local.phase !== "prepared") throw new Error("online.recoveryRequired")
          const current = await resultOf<LocalPetState | undefined>(store.get("current"))
          const remote = trade.sides[profile.id]
          if (
            !current ||
            !remote ||
            JSON.stringify(local.local) !== JSON.stringify(parseOffer(side.offer)) ||
            JSON.stringify(local.remote) !== JSON.stringify(parseOffer(remote.offer))
          )
            throw new Error("social.stale")
          store.put(applyExchange(current, local.local, local.remote, crypto.randomUUID(), Date.now()), "current")
          if (local.local.slot === "principal") store.delete("adventure")
          store.put({ appliedAt: Date.now() }, key)
          local.phase = "resolved"
          addSocialLog(state, "tradeCompleted", display.alias)
        }
        if ((await resultOf(store.get(TRADE_LOCK_KEY))) === trade.id) store.delete(TRADE_LOCK_KEY)
        if (!side.applied) acks.push({ kind: "trades", id: trade.id, pair: pairId })
      } else if (!pending && trade.state !== "committed" && local?.phase === "prepared") {
        local.phase = "aborted"
        if ((await resultOf(store.get(TRADE_LOCK_KEY))) === trade.id) store.delete(TRADE_LOCK_KEY)
      }
    }
    for (const local of Object.values(state.trades))
      if (local.code === code && local.phase === "prepared" && !serverIds.has(local.id)) {
        // A committed, unapplied server decision is never compacted, so absence is safe.
        local.phase = "aborted"
        if ((await resultOf(store.get(TRADE_LOCK_KEY))) === local.id) store.delete(TRADE_LOCK_KEY)
      }
    return acks
  })
