import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { LocalPartnerState } from "../pet/progress.ts"
import { parsePetTransfer, TRANSFER_VERSION } from "../transfer/protocol.ts"

export const normalizeCode = (value: string): string => value.toUpperCase().replace(/[\s-]/g, "")
export const validCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-HJ-NP-Z2-9]{16}$/.test(value)
export const displayCode = (value: string): string => value.match(/.{1,4}/g)?.join("-") ?? value
export const validAlias = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9]{3,16}$/.test(value)
export type Profile = { alias: string; nodeId: string | null; revision: number; arenaNodeId?: string }
export type Friend = { code: string; profile: Profile; confirmed: boolean; requestId?: string }
export type Offer = { slot: "principal" | "reserve"; revision: number; partner: LocalPartnerState }
export type Event =
  | { kind: "invite" }
  | { kind: "decision"; requestId: string; accepted: boolean }
  | { kind: "remove" }
  | { kind: "withdraw"; requestId: string }
  | { kind: "gift"; day: string }
  | { kind: "challenge"; battleCode: string }
  | { kind: "trade-offer"; offer: Offer }
  | { kind: "trade-ready"; tradeId: string; offer: Offer }
  | { kind: "trade-cancel"; tradeId: string }
  | { kind: "trade-abort-request"; tradeId: string }
export type Envelope = { version: 1; id: string; event: Event }
export type Receipt = {
  id: string
  code: string
  profile: Profile
  event: Event
  createdAt: number
  state: "pending" | "done"
}
export type Outgoing = Receipt & { delivery: "unavailable" | "sending" | "delivered" }
export type Trade = {
  id: string
  code: string
  coordinator: boolean
  local: Offer
  remote: Offer
  phase: "prepared" | "committed" | "resolved" | "aborted"
  played: boolean
}
export type SocialState = {
  version: 1
  profile?: { alias: string; revision: number }
  friends: Record<string, Friend>
  inbox: Record<string, Receipt>
  outbox: Record<string, Outgoing>
  trades: Record<string, Trade>
  giftDays: Record<string, string>
  log: { kind: string; alias: string; at: number }[]
}
export const emptySocial = (): SocialState => ({
  version: 1,
  friends: {},
  inbox: {},
  outbox: {},
  trades: {},
  giftDays: {},
  log: [],
})
const record = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x)
export const validId = (x: unknown): x is string => typeof x === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(x)
export const parseProfile = (x: unknown): Profile => {
  if (
    !record(x) ||
    !validAlias(x.alias) ||
    !Number.isSafeInteger(x.revision) ||
    Number(x.revision) < 0 ||
    !(x.nodeId === null || (typeof x.nodeId === "string" && DIGIMON_CATALOG.byId.has(x.nodeId))) ||
    !(x.arenaNodeId === undefined || (typeof x.arenaNodeId === "string" && DIGIMON_CATALOG.byId.has(x.arenaNodeId)))
  )
    throw new Error("Invalid profile")
  return {
    alias: x.alias,
    revision: Number(x.revision),
    nodeId: x.nodeId as string | null,
    ...(typeof x.arenaNodeId === "string" ? { arenaNodeId: x.arenaNodeId } : {}),
  }
}
export const parseOffer = (x: unknown): Offer => {
  if (!record(x) || !record(x.partner)) throw new Error("Invalid offer")
  const inputPartner = x.partner
  if (
    !record(x) ||
    !record(x.partner) ||
    (x.slot !== "principal" && x.slot !== "reserve") ||
    !Number.isSafeInteger(x.revision) ||
    Number(x.revision) < 0 ||
    [
      "reserve",
      "retiredPartners",
      "bossVictories",
      "worldVisit",
      "experienceLevel",
      "teamRevision",
      "pendingEvolution",
      "adventure",
    ].some((k) => inputPartner[k] !== undefined)
  )
    throw new Error("Invalid offer")
  const partner = parsePetTransfer({ version: TRANSFER_VERSION, state: x.partner }).state
  if (!DIGIMON_CATALOG.byId.get(partner.currentNodeId)?.stage) throw new Error("Invalid offer")
  return { slot: x.slot, revision: Number(x.revision), partner }
}
export const parseEnvelope = (x: unknown): Envelope => {
  if (
    !record(x) ||
    x.version !== 1 ||
    !validId(x.id) ||
    !record(x.event) ||
    new TextEncoder().encode(JSON.stringify(x)).byteLength > 32768
  )
    throw new Error("Invalid message")
  const e = x.event
  let event: Event
  if (e.kind === "invite" || e.kind === "remove") event = { kind: e.kind }
  else if (e.kind === "decision" && validId(e.requestId) && typeof e.accepted === "boolean")
    event = { kind: e.kind, requestId: e.requestId, accepted: e.accepted }
  else if (e.kind === "withdraw" && validId(e.requestId)) event = { kind: e.kind, requestId: e.requestId }
  else if (e.kind === "gift" && typeof e.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.day))
    event = { kind: e.kind, day: e.day }
  else if (e.kind === "challenge" && typeof e.battleCode === "string" && /^\d{6}$/.test(e.battleCode))
    event = { kind: e.kind, battleCode: e.battleCode }
  else if (e.kind === "trade-offer") event = { kind: e.kind, offer: parseOffer(e.offer) }
  else if (e.kind === "trade-ready" && validId(e.tradeId))
    event = { kind: e.kind, tradeId: e.tradeId, offer: parseOffer(e.offer) }
  else if ((e.kind === "trade-cancel" || e.kind === "trade-abort-request") && validId(e.tradeId))
    event = { kind: e.kind, tradeId: e.tradeId }
  else throw new Error("Invalid message")
  return { version: 1, id: x.id, event }
}
export const pendingTrade = (state: SocialState): Trade | undefined =>
  Object.values(state.trades).find((t) => t.phase === "prepared" || t.phase === "committed")
export const addSocialLog = (s: SocialState, kind: string, alias: string): void => {
  s.log = [{ kind, alias, at: Date.now() }, ...s.log].slice(0, 100)
}
