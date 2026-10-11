import type { DigimonNode } from "./digimon-node.ts"

export type AdventureBattleRank = "lower" | "same" | "higher" | "boss"
export const ADVENTURE_BATTLE_REWARDS = Object.freeze({ lower: 0.02, same: 0.05, higher: 0.15, boss: 0.5 })

export const adventureBattleRank = (random: () => number): AdventureBattleRank => {
  const roll = random()
  return roll < 0.5 ? "lower" : roll < 0.85 ? "same" : roll < 0.95 ? "higher" : "boss"
}
export const relativeBattleRank = (current: DigimonNode, opponent: DigimonNode): AdventureBattleRank =>
  opponent.stage < current.stage ? "lower" : opponent.stage > current.stage ? "higher" : "same"

/** Missing regional tiers fall back to the nearest non-egg tier; rewards describe the actual encounter. */
export const chooseAdventureEncounter = (
  current: DigimonNode,
  residents: readonly DigimonNode[],
  bosses: readonly DigimonNode[],
  random: () => number,
): { readonly opponent: DigimonNode; readonly rank: AdventureBattleRank } | undefined => {
  const requested = adventureBattleRank(random)
  const bossIds = new Set(bosses.map((node) => node.id))
  const ordinary = residents.filter((node) => node.stage > 0 && !bossIds.has(node.id))
  const target = current.stage + (requested === "lower" ? -1 : requested === "higher" ? 1 : 0)
  const tier = ordinary.filter((node) => node.stage === target)
  const nearestStage = [...ordinary].sort(
    (a, b) => Math.abs(a.stage - current.stage) - Math.abs(b.stage - current.stage),
  )[0]?.stage
  const pool =
    requested === "boss" && bosses.length
      ? bosses
      : tier.length
        ? tier
        : ordinary.filter((node) => node.stage === nearestStage)
  const opponent = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
  return opponent
    ? { opponent, rank: requested === "boss" && bosses.length ? "boss" : relativeBattleRank(current, opponent) }
    : undefined
}
