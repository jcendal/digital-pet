import {
  type BattlePlan,
  type BattleShot,
  type BattleSide,
  COMBAT_POLICY,
} from "@jcendal/digital-pet-core/domain/combat.ts"
import { type Fighter, parseFighter } from "./protocol.ts"

export type AgreedBattle = {
  readonly version: 1
  readonly battleId: string
  readonly seed: string
  readonly challenger: Fighter
  readonly receiver: Fighter
  readonly localSide: BattleSide
  readonly plan: BattlePlan
}

export type PendingBattle = AgreedBattle & {
  readonly completedShots: number
  readonly rewarded: boolean
  readonly agreedAt: number
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const side = (value: unknown): value is BattleSide => value === "player" || value === "opponent"

/** Restore the recorded plan, including across catalogue changes; never roll it again. */
export const parsePendingBattle = (value: unknown): PendingBattle => {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.battleId !== "string" ||
    !/^[a-f0-9-]{36}$/.test(value.battleId) ||
    typeof value.seed !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.seed) ||
    !side(value.localSide) ||
    typeof value.rewarded !== "boolean" ||
    typeof value.agreedAt !== "number" ||
    !Number.isSafeInteger(value.agreedAt) ||
    value.agreedAt < 0 ||
    !record(value.plan) ||
    !Array.isArray(value.plan.shots) ||
    value.plan.shots.length < 1 ||
    value.plan.shots.length > COMBAT_POLICY.maxShots ||
    typeof value.completedShots !== "number" ||
    !Number.isInteger(value.completedShots) ||
    value.completedShots < 0 ||
    value.completedShots > value.plan.shots.length
  )
    throw new Error("Invalid saved battle")
  const hits = { player: 0, opponent: 0 }
  let previous: BattleSide | undefined
  const plannedShots = value.plan.shots
  const shots: BattleShot[] = plannedShots.map((shot: unknown, index: number) => {
    if (!record(shot) || !side(shot.shooter) || typeof shot.hit !== "boolean" || shot.shooter === previous)
      throw new Error("Invalid saved battle attacks")
    previous = shot.shooter
    if (shot.hit) hits[shot.shooter]++
    if (hits[shot.shooter] === COMBAT_POLICY.hitsToWin && index !== plannedShots.length - 1)
      throw new Error("Saved battle continues after its winner")
    return { shooter: shot.shooter, hit: shot.hit }
  })
  const outcome =
    hits.player === COMBAT_POLICY.hitsToWin ? "player" : hits.opponent === COMBAT_POLICY.hitsToWin ? "opponent" : "draw"
  if (value.plan.outcome !== outcome || (outcome === "draw" && shots.length !== COMBAT_POLICY.maxShots))
    throw new Error("Invalid saved battle result")
  return {
    version: 1,
    battleId: value.battleId,
    seed: value.seed,
    challenger: parseFighter(value.challenger),
    receiver: parseFighter(value.receiver),
    localSide: value.localSide,
    plan: { shots, outcome },
    completedShots: value.completedShots,
    rewarded: value.rewarded,
    agreedAt: value.agreedAt,
  }
}
