import { expect, test } from "bun:test"
import { battlePlanForOpponent, planSeededCombat } from "../src/domain/peer-combat.ts"

const player = { strength: 73, evasion: 41 }
const opponent = { strength: 52, evasion: 68 }

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
