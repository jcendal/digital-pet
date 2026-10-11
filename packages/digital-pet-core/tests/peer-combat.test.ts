import { expect, test } from "bun:test"
import { battleExperienceFraction, battlePlanForOpponent, planSeededCombat } from "../src/domain/peer-combat.ts"

const player = { strength: 73, evasion: 41 }
const opponent = { strength: 52, evasion: 68 }

test("peer prizes halve for each weaker stage and double for each stronger stage", () => {
  for (const [stage, fraction] of [
    [1, 0.05],
    [2, 0.1],
    [3, 0.2],
    [4, 0.4],
    [5, 0.8],
    [6, 1.6],
  ] as const)
    expect(battleExperienceFraction(3, stage)).toBe(fraction)
  expect(battleExperienceFraction(0, 3)).toBe(0)
  expect(battleExperienceFraction(3, 0)).toBe(0)
})

test("identical agreed seeds reproduce every shot, and perspective preserves the same winner", () => {
  const seed = "0123456789abcdef".repeat(4)
  const plan = planSeededCombat(player, opponent, seed)
  expect(planSeededCombat(player, opponent, seed)).toEqual(plan)
  const mirrored = battlePlanForOpponent(plan)
  expect(battlePlanForOpponent(mirrored)).toEqual(plan)
  expect(mirrored.shots).toEqual(
    plan.shots.map((shot) => ({
      hit: shot.hit,
      shooter: shot.shooter === "player" ? "opponent" : "player",
    })),
  )
  expect(() => planSeededCombat(player, opponent, "bad")).toThrow("seed")
})
