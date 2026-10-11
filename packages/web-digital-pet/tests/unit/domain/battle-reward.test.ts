import { expect, test } from "bun:test"
import { rewardBattleWinner } from "../../../src/domain/battle/reward.ts"
import { experienceThresholds, type LocalPetState } from "../../../src/domain/pet/progress.ts"

const now = Date.now()
const partner: LocalPetState = {
  partnerId: "winner",
  currentNodeId: "3-001",
  gauge: 0,
  isTerminal: false,
  lastTickAt: now,
  createdAt: new Date(now).toISOString(),
  events: [{ currentNodeId: "3-001", createdAt: new Date(now).toISOString() }],
}

test("a win earns 20% of the chosen level, caps at its threshold and queues normal evolution", () => {
  for (const experienceLevel of ["low", "normal", "high"] as const) {
    const state = { ...partner, experienceLevel }
    expect(rewardBattleWinner(state, state, "3-002", now).gauge).toBe(experienceThresholds(experienceLevel)[3] * 0.2)
    const nearly = { ...state, gauge: experienceThresholds(experienceLevel)[3] * 0.9 }
    const result = rewardBattleWinner(nearly, state, "3-002", now)
    expect(result.gauge).toBe(experienceThresholds(experienceLevel)[3])
    expect(result.pendingEvolution).toBeDefined()
    expect(result.currentNodeId).toBe(state.currentNodeId)
  }
})

test("stale results never reward a replacement, evolved or terminal companion, or changed difficulty", () => {
  for (const state of [
    { ...partner, partnerId: "replacement" },
    { ...partner, currentNodeId: "4-001" },
    { ...partner, isTerminal: true },
    { ...partner, experienceLevel: "low" as const },
  ])
    expect(rewardBattleWinner(state, partner, "4-001", now)).toBe(state)
})

test("the prize scales with the recorded opponent's stage at every experience setting", () => {
  for (const experienceLevel of ["low", "normal", "high"] as const) {
    const state = { ...partner, experienceLevel }
    const threshold = experienceThresholds(experienceLevel)[3]
    for (const [opponent, fraction] of [
      ["1-001", 0.05],
      ["2-001", 0.1],
      ["4-001", 0.4],
      ["5-001", 0.8],
    ] as const)
      expect(rewardBattleWinner(state, state, opponent, now).gauge).toBe(Math.ceil(threshold * fraction))
    expect(rewardBattleWinner(state, state, "6-001", now).pendingEvolution).toBeDefined()
    expect(rewardBattleWinner(state, state, "0-001", now)).toBe(state)
    expect(rewardBattleWinner(state, state, "missing", now)).toBe(state)
  }
})
