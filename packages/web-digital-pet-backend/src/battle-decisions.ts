import { type Destination, identifier, OnlineError, sameDestination } from "@jcendal/digital-pet-online/contracts.ts"
import type { OnlineRelationship } from "@jcendal/digital-pet-online/social.ts"
import { digest } from "./identity.ts"
import { change, type ObjectStore } from "./store.ts"

type Member = { accountId: string; installationId: string; connectionId: string }
export type BattleDecision = {
  members: Member[]
  reports: Record<string, { destination: Destination; digest: string }>
  state: "pending" | "committed" | "canceled"
  expiresAt: number
  friendship?: { id: string; generation: number }
  published?: boolean
}
export type BattleRelationship = OnlineRelationship & { battles?: Record<string, BattleDecision> }
type Link = { namespace: string; members: Member[]; expiresAt: number; friendship?: BattleDecision["friendship"] }

export const compactBattles = (pair: BattleRelationship, now: number): void => {
  for (const [id, battle] of Object.entries(pair.battles ?? {})) {
    if (battle.state === "pending" && battle.expiresAt <= now) battle.state = "canceled"
    // Retain terminal entries beyond every in-flight Lambda invocation before pruning.
    if ((battle.published || battle.state === "canceled") && battle.expiresAt < now - 120_000) delete pair.battles?.[id]
  }
}

const reportBattle = (value: BattleDecision, actor: string, destination: Destination, now: number, report?: string) => {
  if (
    !value.members.some((member) => member.accountId === actor && member.installationId === destination.installationId)
  )
    throw new OnlineError("forbidden", 403)
  const identity = digest(`${actor}:${destination.installationId}`)
  const old = value.reports[identity]
  if (old && !sameDestination(old.destination, destination)) throw new OnlineError("destination-conflict", 409)
  if (value.state === "pending" && value.expiresAt <= now) value.state = "canceled"
  if (report) {
    if (!/^[a-f0-9]{64}$/.test(report)) throw new OnlineError("invalid-report")
    if (old && old.digest !== report) throw new OnlineError("report-conflict", 409)
    if (value.state === "pending") {
      value.reports[identity] = { destination, digest: report }
      const reports = Object.values(value.reports)
      if (reports.length === 2) value.state = reports[0]?.digest === reports[1]?.digest ? "committed" : "canceled"
    }
  }
  return value
}

/** Friend removal and the final report share one relationship CAS. Terminal copies remain durable. */
export class BattleDecisions {
  constructor(
    private store: ObjectStore,
    private now = Date.now,
  ) {}
  async decide(actor: string, channel: string, destination: Destination, report?: string) {
    identifier(channel)
    const key = `battle-decisions/${channel}`
    const existing = await this.store.get<BattleDecision>(key)
    if (existing && existing.value.state !== "pending") {
      const result = reportBattle(existing.value, actor, destination, this.now(), report)
      return { state: result.state, expiresAt: result.expiresAt }
    }
    const link = await this.store.get<Link>(`realtime/channels/${channel}`)
    if (!existing && (!link || link.value.namespace !== "battle" || link.value.expiresAt <= this.now()))
      return { state: "canceled" as const }
    const friendship = existing?.value.friendship ?? link?.value.friendship
    const initial: BattleDecision = {
      ...(existing?.value ?? {
        members: link!.value.members,
        reports: {},
        state: "pending",
        expiresAt: this.now() + 120_000,
      }),
      ...(friendship ? { friendship } : {}),
    }
    // Validate membership before creating any durable routing entry.
    reportBattle(structuredClone(initial), actor, destination, this.now(), report)
    let result: BattleDecision
    if (!friendship) {
      result = await change(
        this.store,
        key,
        () => initial,
        (value) => reportBattle(value, actor, destination, this.now(), report),
      )
    } else {
      // This pointer survives channel expiry and must precede the canonical relationship write.
      await change<BattleDecision, void>(
        this.store,
        key,
        () => initial,
        () => {},
      )
      const pairKey = `relationships/${friendship.id}`
      result = await change<BattleRelationship, BattleDecision>(
        this.store,
        pairKey,
        () => {
          throw new OnlineError("not-friends", 409)
        },
        (pair) => {
          compactBattles(pair, this.now())
          pair.battles ??= {}
          if (!pair.battles[channel] && Object.keys(pair.battles).length >= 128)
            throw new OnlineError("battle-limit", 429)
          pair.battles[channel] ??= structuredClone(initial)
          const decision = pair.battles[channel]
          if (decision.state === "pending" && (!pair.active || pair.generation !== friendship.generation))
            decision.state = "canceled"
          return reportBattle(decision, actor, destination, this.now(), report)
        },
      )
      if (result.state !== "pending") {
        await change<BattleDecision, void>(
          this.store,
          key,
          () => result,
          (value) => {
            Object.assign(value, result)
          },
        )
        await change<BattleRelationship, void>(
          this.store,
          pairKey,
          () => {
            throw new OnlineError("not-found", 404)
          },
          (pair) => {
            const decision = pair.battles?.[channel]
            if (decision?.state === result.state) decision.published = true
          },
        )
      }
    }
    return { state: result.state, expiresAt: result.expiresAt }
  }
}
