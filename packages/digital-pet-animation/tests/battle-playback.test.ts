import { expect, mock, test } from "bun:test"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { BattlePlan } from "@jcendal/digital-pet-core/domain/combat.ts"
import { type BattleFrameHud, runEvolutionBattleAnimation } from "../src/sequences/evolution-battle-artwork.ts"

mock.module("../src/utils/sleep.ts", () => ({ sleep: async () => {} }))
const plan: BattlePlan = {
  outcome: "player",
  shots: [
    { shooter: "player", hit: true },
    { shooter: "opponent", hit: true },
    { shooter: "player", hit: true },
    { shooter: "opponent", hit: true },
    { shooter: "player", hit: true },
  ],
}

test("recovering battle playback starts with saved scores and checkpoints only remaining attacks", async () => {
  const huds: BattleFrameHud[] = []
  const checkpoints: number[] = []
  const outcome = await runEvolutionBattleAnimation(
    MONSTER_FRAME_CATALOG,
    "agumon",
    "gabumon",
    40,
    plan,
    async (_artwork, hud) => {
      if (hud) huds.push(hud)
    },
    {
      completedShots: 2,
      onShotComplete: async (count) => {
        checkpoints.push(count)
      },
    },
  )
  expect(outcome).toBe("player")
  expect(huds[0]?.playerHits).toBe(1)
  expect(huds[0]?.opponentHits).toBe(1)
  expect(checkpoints).toEqual([3, 4, 5])
  expect(huds.at(-1)?.caption).toBe("WIN!")
  expect(huds.at(-1)?.playerHits).toBe(3)
})

test("all attacks completed restores only the final result", async () => {
  const huds: BattleFrameHud[] = []
  await runEvolutionBattleAnimation(
    MONSTER_FRAME_CATALOG,
    "agumon",
    "gabumon",
    40,
    plan,
    async (_artwork, hud) => {
      if (hud) huds.push(hud)
    },
    {
      completedShots: plan.shots.length,
      onShotComplete: async () => {
        throw new Error("Must not replay")
      },
    },
  )
  expect(huds.every((hud) => hud.caption === "WIN!" && hud.playerHits === 3 && hud.opponentHits === 2)).toBe(true)
  await expect(
    runEvolutionBattleAnimation(MONSTER_FRAME_CATALOG, "agumon", "gabumon", 40, plan, async () => {}, {
      completedShots: -1,
    }),
  ).rejects.toThrow("Invalid battle playback checkpoint")
})
