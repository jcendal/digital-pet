import { expect, mock, test } from "bun:test"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"

mock.module("../src/utils/sleep.ts", () => ({ sleep: async () => {} }))

import { runAdventureBattleSession } from "../src/sessions/adventure-battle-session.ts"

const saved: AdventureState = {
  id: "trip",
  nodeId: "3-001",
  regionId: "digital-ocean",
  running: true,
  status: "travel",
  elapsedMs: 6000,
  lastTickAt: 6000,
  nextEventAt: 21000,
  sequence: 1,
  collected: 0,
  victories: 0,
  event: {
    kind: "battle",
    id: 1,
    opponentNodeId: "3-007",
    difficult: false,
    completedShots: 1,
    plan: { outcome: "player", shots: [1, 2, 3].map(() => ({ shooter: "player", hit: true })) },
  },
}

test("an adventure battle resumes its checkpoints and rewards after all outcome frames", async () => {
  const order: string[] = []
  const checkpoints: number[] = []
  const played = await runAdventureBattleSession(saved, 50, {
    frames: MONSTER_FRAME_CATALOG,
    catalog: DIGIMON_CATALOG,
    active: () => true,
    onState: async (state) => {
      order.push(state.phase)
    },
    onFrame: async (_artwork, hud) => {
      order.push(hud?.caption ?? "frame")
    },
    checkpoint: async (_id, shots) => {
      checkpoints.push(shots)
      return true
    },
    finish: async () => {
      expect(order.at(-1)).toBe("WIN!")
      order.push("reward")
    },
  })
  expect(played).toBe(true)
  expect(checkpoints).toEqual([2, 3])
  expect(order.at(-1)).toBe("reward")
})

test("hiding the viewer interrupts playback without awarding or advancing an unshown shot", async () => {
  let active = true
  let rewarded = false
  let checkpoints = 0
  expect(
    await runAdventureBattleSession(saved, 50, {
      frames: MONSTER_FRAME_CATALOG,
      catalog: DIGIMON_CATALOG,
      active: () => active,
      onState: async () => {},
      onFrame: async () => {
        active = false
      },
      checkpoint: async () => {
        checkpoints++
        return true
      },
      finish: async () => {
        rewarded = true
      },
    }),
  ).toBe(false)
  expect(checkpoints).toBe(0)
  expect(rewarded).toBe(false)
})

test("bosses have a separate reveal before battle and never award experience during their intro", async () => {
  if (saved.event?.kind !== "battle") throw new Error("Missing battle")
  const boss: AdventureState = {
    ...saved,
    event: { ...saved.event, opponentNodeId: "6-095", rank: "boss", completedShots: 0 },
  }
  const order: string[] = []
  let intro = false
  await runAdventureBattleSession(boss, 50, {
    frames: MONSTER_FRAME_CATALOG,
    catalog: DIGIMON_CATALOG,
    active: () => true,
    onState: async (state) => {
      intro = state.phase === "battle" && state.bossIntro === true
      order.push(intro ? "boss-intro" : "battle")
    },
    onFrame: async (_artwork, hud) => {
      if (intro) expect(hud).toBeUndefined()
      order.push(intro ? "reveal" : (hud?.caption ?? "frame"))
    },
    checkpoint: async () => {
      expect(intro).toBe(false)
      return true
    },
    finish: async () => {
      expect(order.at(-1)).toBe("WIN!")
      order.push("reward")
    },
  })
  expect(order.slice(0, 5)).toEqual(["boss-intro", "reveal", "reveal", "reveal", "battle"])
  expect(order.at(-1)).toBe("reward")
})
