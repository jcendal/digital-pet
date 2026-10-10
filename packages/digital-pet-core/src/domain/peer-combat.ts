import { IntlModule } from "../i18n.ts"
import { type BattlePlan, type CombatStats, planCombat } from "./combat.ts"

export const BATTLE_EXPERIENCE_FRACTION = 0.2

/** Protocol v1: canonical player is always the challenger, on both machines. */
export const planSeededCombat = (player: CombatStats, opponent: CombatStats, seed: string): BattlePlan => {
  if (!/^[a-f0-9]{64}$/.test(seed)) throw new Error(IntlModule.translate("errors.invalidCombatSeed"))
  const word = (index: number): number => Number.parseInt(seed.slice(index * 8, index * 8 + 8), 16)
  let a = (word(0) ^ word(4)) >>> 0
  let b = (word(1) ^ word(5)) >>> 0
  let c = (word(2) ^ word(6)) >>> 0
  let d = (word(3) ^ word(7)) >>> 0
  return planCombat(player, opponent, () => {
    const result = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = ((c << 21) | (c >>> 11)) + result
    return (result >>> 0) / 4294967296
  })
}

export const battlePlanForOpponent = (plan: BattlePlan): BattlePlan => ({
  outcome: plan.outcome === "draw" ? "draw" : plan.outcome === "player" ? "opponent" : "player",
  shots: plan.shots.map((shot) => ({ ...shot, shooter: shot.shooter === "player" ? "opponent" : "player" })),
})
