import { adventureBusy, parseAdventure } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { LocalPetState } from "../../domain/pet/progress.ts"
import { applyExchange, offerMatches } from "../../domain/social/exchange.ts"
import {
  addSocialLog,
  type Envelope,
  type Event,
  emptySocial,
  type Profile,
  pendingTrade,
  type SocialState,
  type Trade,
  validAlias,
  validCode,
} from "../../domain/social/model.ts"
import { completed, openDatabase, resultOf, TRADE_LOCK_KEY } from "./database.ts"

const KEY = "social:v1"
export const updateSocial = async <T>(
  change: (state: SocialState, store: IDBObjectStore) => T | Promise<T>,
): Promise<T> => {
  const db = await openDatabase()
  try {
    const tx = db.transaction("pet", "readwrite")
    const done = completed(tx)
    // Observe transaction failures even if validation rejects before awaiting completion.
    void done.catch(() => {})
    try {
      const store = tx.objectStore("pet")
      const state = (await resultOf<SocialState | undefined>(store.get(KEY))) ?? emptySocial()
      const result = await change(state, store)
      store.put(state, KEY)
      await done
      return result
    } catch (error) {
      try {
        tx.abort()
      } catch {}
      throw error
    }
  } finally {
    db.close()
  }
}
export const readSocial = async (): Promise<SocialState> => {
  const db = await openDatabase()
  try {
    return (await resultOf<SocialState | undefined>(db.transaction("pet").objectStore("pet").get(KEY))) ?? emptySocial()
  } finally {
    db.close()
  }
}
export const saveAlias = (alias: string): Promise<void> =>
  updateSocial((s) => {
    if (!validAlias(alias)) throw new Error("social.aliasRule")
    s.profile = { alias, revision: (s.profile?.revision ?? 0) + 1 }
  })
export const queueSocial = (code: string, event: Event, id = crypto.randomUUID()): Promise<string> =>
  updateSocial(async (s, store) => {
    if (!s.profile || !validCode(code)) throw new Error("social.chooseAlias")
    if (
      event.kind !== "invite" &&
      event.kind !== "decision" &&
      event.kind !== "remove" &&
      event.kind !== "withdraw" &&
      !s.friends[code]?.confirmed
    )
      throw new Error("social.notFriend")
    if (event.kind === "trade-offer") {
      const current = await resultOf<LocalPetState | undefined>(store.get("current"))
      if (!current || !offerMatches(current, event.offer)) throw new Error("social.stale")
      if (pendingTrade(s) || current.pendingEvolution || current.reserve?.pendingEvolution)
        throw new Error("social.busy")
    }
    if (event.kind === "invite") {
      if (s.friends[code]) throw new Error("social.alreadyFriend")
      const old = Object.values(s.outbox).find(
        (r) => r.code === code && r.event.kind === "invite" && r.state === "pending",
      )
      if (old) return old.id
    }
    if (Object.values(s.outbox).filter((r) => r.state === "pending").length >= 256) throw new Error("social.full")
    if (event.kind === "gift") {
      if (s.giftDays[code] === event.day) throw new Error("social.giftLimit")
      s.giftDays[code] = event.day
    }
    s.outbox[id] = {
      id,
      code,
      event,
      profile: s.friends[code]?.profile ?? { alias: "PLAYER", nodeId: null, revision: 0 },
      createdAt: Date.now(),
      state: "pending",
      delivery: "unavailable",
    }
    return id
  })
export const receiveSocial = (code: string, profile: Profile, message: Envelope): Promise<void> =>
  updateSocial((s) => {
    const old = s.inbox[message.id]
    if (old) {
      if (old.code !== code || JSON.stringify(old.event) !== JSON.stringify(message.event))
        throw new Error("social.invalid")
      return
    }
    const e = message.event
    if (Object.values(s.inbox).filter((r) => r.state === "pending").length >= 256) throw new Error("social.full")
    if (
      e.kind !== "invite" &&
      e.kind !== "decision" &&
      e.kind !== "withdraw" &&
      e.kind !== "remove" &&
      !s.friends[code]?.confirmed
    )
      throw new Error("social.notFriend")
    if (e.kind === "decision") {
      const request = s.outbox[e.requestId]
      if (!request || request.code !== code || request.event.kind !== "invite") throw new Error("social.invalid")
      const cancelled = request.state === "done"
      request.state = "done"
      if (e.accepted && !cancelled) {
        s.friends[code] = { code, profile, confirmed: true, requestId: e.requestId }
        addSocialLog(s, "friendAccepted", profile.alias)
      }
    }
    if (e.kind === "withdraw") {
      if (pendingTrade(s)?.code === code) throw new Error("social.busy")
      const request = s.inbox[e.requestId]
      if (request?.code === code && request.event.kind === "invite") {
        request.state = "done"
        if (s.friends[code]?.requestId === request.id) delete s.friends[code]
        for (const outgoing of Object.values(s.outbox))
          if (outgoing.code === code && outgoing.event.kind === "decision" && outgoing.event.requestId === request.id)
            outgoing.state = "done"
      }
    }
    if (e.kind === "gift") {
      if (
        e.day !== new Date().toISOString().slice(0, 10) ||
        Object.values(s.inbox).some((r) => r.code === code && r.event.kind === "gift" && r.event.day === e.day)
      )
        throw new Error("social.giftLimit")
    }
    if (e.kind === "trade-ready") {
      const request = s.outbox[e.tradeId]
      if (!request || request.code !== code || request.event.kind !== "trade-offer") throw new Error("social.invalid")
    }
    if (e.kind === "remove") {
      delete s.friends[code]
      addSocialLog(s, "friendRemoved", profile.alias)
    }
    s.inbox[message.id] = {
      id: message.id,
      code,
      profile,
      event: e,
      createdAt: Date.now(),
      state:
        ["decision", "remove", "withdraw", "trade-cancel", "trade-abort-request"].includes(e.kind) ||
        (e.kind === "trade-ready" && s.outbox[e.tradeId]?.state === "done")
          ? "done"
          : "pending",
    }
  })
export const acknowledgeSocial = (code: string, id: string): Promise<void> =>
  updateSocial((s) => {
    const r = s.outbox[id]
    if (!r || r.code !== code || r.delivery === "delivered") return
    if (r.event.kind === "gift") addSocialLog(s, "giftSent", r.profile.alias)
    r.delivery = "delivered"
    if (r.event.kind !== "invite" && r.event.kind !== "trade-offer") r.state = "done"
    if (r.event.kind === "decision" && r.event.accepted && s.friends[code]) {
      s.friends[code].confirmed = true
      addSocialLog(s, "friendAccepted", r.profile.alias)
    }
  })
export const decideFriend = (id: string, accepted: boolean): Promise<{ code: string; id: string }> =>
  updateSocial((s) => {
    const r = s.inbox[id]
    if (!r || r.event.kind !== "invite" || r.state !== "pending" || !s.profile) throw new Error("social.invalid")
    r.state = "done"
    if (accepted) s.friends[r.code] = { code: r.code, profile: r.profile, confirmed: false, requestId: id }
    const decisionId = crypto.randomUUID()
    s.outbox[decisionId] = {
      id: decisionId,
      code: r.code,
      profile: r.profile,
      event: { kind: "decision", requestId: id, accepted },
      createdAt: Date.now(),
      state: "pending",
      delivery: "unavailable",
    }
    return { code: r.code, id: decisionId }
  })
export const removeFriend = (code: string): Promise<void> =>
  updateSocial((s) => {
    if (Object.values(s.trades).some((t) => t.code === code && (t.phase === "prepared" || t.phase === "committed")))
      throw new Error("social.busy")
    const friend = s.friends[code]
    if (!friend) return
    delete s.friends[code]
    for (const r of [...Object.values(s.inbox), ...Object.values(s.outbox)])
      if (r.code === code && r.state === "pending") r.state = "done"
    const id = crypto.randomUUID()
    s.outbox[id] = {
      id,
      code,
      profile: friend.profile,
      event: { kind: "remove" },
      createdAt: Date.now(),
      state: "pending",
      delivery: "unavailable",
    }
    addSocialLog(s, "friendRemoved", friend.profile.alias)
  })
export const collectGift = (id: string): Promise<void> =>
  updateSocial(async (s, store) => {
    const r = s.inbox[id]
    const state = await resultOf<LocalPetState | undefined>(store.get("current"))
    const lock = await resultOf(store.get(TRADE_LOCK_KEY))
    if (
      !r ||
      r.event.kind !== "gift" ||
      r.state !== "pending" ||
      !state ||
      lock ||
      state.pendingEvolution ||
      state.currentNodeId.startsWith("0-") ||
      state.food?.kind === "available"
    )
      throw new Error("social.foodPending")
    store.put({ ...state, food: { kind: "available" } }, "current")
    r.state = "done"
    addSocialLog(s, "giftCollected", r.profile.alias)
  })
export const prepareTrade = (trade: Trade): Promise<void> =>
  updateSocial(async (s, store) => {
    const old = s.trades[trade.id]
    if (old) {
      if (
        old.code !== trade.code ||
        JSON.stringify(old.local) !== JSON.stringify(trade.local) ||
        JSON.stringify(old.remote) !== JSON.stringify(trade.remote)
      )
        throw new Error("social.invalid")
      return
    }
    const request = trade.coordinator ? s.outbox[trade.id] : s.inbox[trade.id]
    if (
      !request ||
      request.code !== trade.code ||
      request.state !== "pending" ||
      request.event.kind !== "trade-offer" ||
      JSON.stringify(request.event.offer) !== JSON.stringify(trade.coordinator ? trade.local : trade.remote)
    )
      throw new Error("social.invalid")
    if (
      trade.coordinator &&
      !Object.values(s.inbox).some(
        (r) =>
          r.code === trade.code &&
          r.state === "pending" &&
          r.event.kind === "trade-ready" &&
          r.event.tradeId === trade.id &&
          JSON.stringify(r.event.offer) === JSON.stringify(trade.remote),
      )
    )
      throw new Error("social.invalid")
    const current = await resultOf<LocalPetState | undefined>(store.get("current"))
    const battle = await resultOf(store.get("pending-battle"))
    const trip = await resultOf<{ partnerId: string; state: unknown } | undefined>(store.get("adventure"))
    if (
      !s.friends[trade.code]?.confirmed ||
      !current ||
      pendingTrade(s) ||
      battle ||
      current.pendingEvolution ||
      current.reserve?.pendingEvolution ||
      adventureBusy(trip?.partnerId === current.partnerId ? parseAdventure(trip.state) : undefined)
    )
      throw new Error("social.busy")
    if (!offerMatches(current, trade.local)) throw new Error("social.stale")
    if ((current.retiredPartners?.length ?? 0) >= 128 || Date.parse(trade.local.partner.createdAt) > Date.now())
      throw new Error("social.full")
    s.trades[trade.id] = trade
    if (!trade.coordinator && s.inbox[trade.id]) {
      const request = s.inbox[trade.id]
      if (request) request.state = "done"
    }
    if (!trade.coordinator) {
      const id = crypto.randomUUID()
      s.outbox[id] = {
        id,
        code: trade.code,
        profile: s.friends[trade.code]?.profile ?? { alias: "PLAYER", nodeId: null, revision: 0 },
        event: { kind: "trade-ready", tradeId: trade.id, offer: trade.local },
        createdAt: Date.now(),
        state: "pending",
        delivery: "unavailable",
      }
    }
    store.put(trade.id, TRADE_LOCK_KEY)
  })
export const commitTrade = (id: string, code: string): Promise<void> =>
  updateSocial(async (s, store) => {
    const t = s.trades[id]
    if (!t || t.code !== code || t.phase === "aborted") throw new Error("social.invalid")
    if (t.phase !== "prepared") return
    const current = await resultOf<LocalPetState | undefined>(store.get("current"))
    if (!current) throw new Error("social.invalid")
    store.put(applyExchange(current, t.local, t.remote, crypto.randomUUID(), Date.now()), "current")
    if (t.local.slot === "principal") store.delete("adventure")
    t.phase = "committed"
  })
export const resolveTrade = (id: string, code: string): Promise<void> =>
  updateSocial((s, store) => {
    const t = s.trades[id]
    if (!t || t.code !== code || (t.phase !== "committed" && t.phase !== "resolved")) throw new Error("social.invalid")
    if (t.phase === "resolved") return
    t.phase = "resolved"
    store.delete(TRADE_LOCK_KEY)
    for (const r of [...Object.values(s.inbox), ...Object.values(s.outbox)])
      if (r.id === id || (r.event.kind === "trade-ready" && r.event.tradeId === id)) r.state = "done"
    addSocialLog(s, "tradeCompleted", s.friends[code]?.profile.alias ?? "PLAYER")
  })
export const abortTrade = (id: string, code: string): Promise<boolean> =>
  updateSocial((s, store) => {
    const t = s.trades[id]
    if (t && (t.code !== code || t.phase === "committed" || t.phase === "resolved")) return false
    if (t?.phase === "aborted") return true
    if (t) {
      t.phase = "aborted"
      store.delete(TRADE_LOCK_KEY)
    }
    for (const r of [...Object.values(s.inbox), ...Object.values(s.outbox)])
      if (r.code === code && (r.id === id || (r.event.kind === "trade-ready" && r.event.tradeId === id)))
        r.state = "done"
    return true
  })

export const cancelInvitation = (id: string): Promise<string | undefined> =>
  updateSocial((s) => {
    const r = s.outbox[id]
    if (!r || r.event.kind !== "invite" || r.state !== "pending") return
    r.state = "done"
    const withdrawal = crypto.randomUUID()
    s.outbox[withdrawal] = {
      ...r,
      id: withdrawal,
      event: { kind: "withdraw", requestId: id },
      state: "pending",
      delivery: "unavailable",
    }
    return withdrawal
  })
