import { expect, test } from "bun:test"
import { planSeededCombat } from "@jcendal/digital-pet-core/domain/peer-combat.ts"
import { battleNode } from "../../../src/domain/battle/protocol.ts"
import { parsePendingBattle } from "../../../src/domain/battle/saved-battle.ts"

const seed = "a".repeat(64)
const saved = {
  version: 1,
  battleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  seed,
  challenger: { partnerId: "alice", nodeId: "3-001" },
  receiver: { partnerId: "bob", nodeId: "4-001" },
  localSide: "player",
  plan: planSeededCombat(battleNode("3-001").combatStats, battleNode("4-001").combatStats, seed),
  completedShots: 1,
  rewarded: false,
  agreedAt: Date.now(),
}
test("a saved plan and seed survive a round trip unchanged", () => {
  expect(parsePendingBattle(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
})
test("saved battle recovery rejects impossible checkpoints and changed results", () => {
  for (const completedShots of [-1, 0.5, saved.plan.shots.length + 1])
    expect(() => parsePendingBattle({ ...saved, completedShots })).toThrow()
  expect(() => parsePendingBattle({ ...saved, seed: "random" })).toThrow()
  expect(() => parsePendingBattle({ ...saved, plan: { ...saved.plan, outcome: "draw" } })).toThrow()
})

test("deferred rewards preserve the agreed companion and level; legacy battles remain readable", () => {
  const rewardTarget = { partnerId: "alice", currentNodeId: "3-001", experienceLevel: "normal" }
  expect(parsePendingBattle({ ...saved, rewardTarget }).rewardTarget).toEqual(rewardTarget)
  expect(parsePendingBattle(saved).rewardTarget).toBeUndefined()
  for (const target of [
    { ...rewardTarget, partnerId: "replacement" },
    { ...rewardTarget, currentNodeId: "4-001" },
    { ...rewardTarget, experienceLevel: "invalid" },
    null,
  ])
    expect(() => parsePendingBattle({ ...saved, rewardTarget: target })).toThrow()
})
