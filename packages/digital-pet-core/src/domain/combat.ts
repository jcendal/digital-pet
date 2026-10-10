import { IntlModule } from "../i18n.ts"
/** Game balance, shared by every host. Strength controls accuracy, not damage. */
export type CombatStats = { readonly strength: number; readonly evasion: number }
export type BattleSide = "player" | "opponent"
export type BattleOutcome = BattleSide | "draw"
export type BattleShot = { readonly shooter: BattleSide; readonly hit: boolean }
export type BattlePlan = { readonly shots: readonly BattleShot[]; readonly outcome: BattleOutcome }

export const COMBAT_POLICY = Object.freeze({ hitsToWin: 3, maxShots: 24, scale: 25, minimum: 0.05, maximum: 0.95 })
export const NEUTRAL_COMBAT_STATS: CombatStats = Object.freeze({ strength: 50, evasion: 50 })

export const validateCombatStats = (stats: CombatStats): CombatStats => {
  for (const value of [stats.strength, stats.evasion]) {
    if (!Number.isInteger(value) || value < 0 || value > 100)
      throw new Error(IntlModule.translate("errors.invalidCombatStats"))
  }
  return Object.freeze({ ...stats })
}

/** Logistic opposed check: equal scores give 50%; extremes never guarantee a hit or miss. */
export const hitProbability = (attacker: CombatStats, defender: CombatStats): number => {
  validateCombatStats(attacker)
  validateCombatStats(defender)
  const probability = 1 / (1 + Math.exp(-(attacker.strength - defender.evasion) / COMBAT_POLICY.scale))
  return Math.max(COMBAT_POLICY.minimum, Math.min(COMBAT_POLICY.maximum, probability))
}

const roll = (random: () => number): number => {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error(IntlModule.translate("errors.invalidCombatRandom"))
  return value
}

/** The winner emerges from real hit rolls. A time limit without three hits is a draw. */
export const planCombat = (
  player: CombatStats,
  opponent: CombatStats,
  random: () => number = Math.random,
): BattlePlan => {
  const chances = { player: hitProbability(player, opponent), opponent: hitProbability(opponent, player) }
  const hits = { player: 0, opponent: 0 }
  const shots: BattleShot[] = []
  let shooter: BattleSide = roll(random) < 0.5 ? "player" : "opponent"
  while (shots.length < COMBAT_POLICY.maxShots) {
    const hit = roll(random) < chances[shooter]
    shots.push(Object.freeze({ shooter, hit }))
    if (hit) hits[shooter]++
    if (hits[shooter] === COMBAT_POLICY.hitsToWin)
      return Object.freeze({ shots: Object.freeze(shots), outcome: shooter })
    shooter = shooter === "player" ? "opponent" : "player"
  }
  return Object.freeze({ shots: Object.freeze(shots), outcome: "draw" })
}
