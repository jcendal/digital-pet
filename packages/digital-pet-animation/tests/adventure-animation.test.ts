import { expect, test } from "bun:test"
import { MONSTER_SLEEP_AFTER_MS } from "../src/constants/presentation-timing.ts"
import { MonsterAnimationController } from "../src/idle/monster-animation.ts"
import { catalogFor, controlledClock, frameContent, partnerChanged } from "./monster-animation-test-utils.ts"

test("adventure alternates walking frames facing forward, without idle actions, sleep or mood overrides", () => {
  const clock = controlledClock()
  const controller = new MonsterAnimationController(
    catalogFor(new Map([["pet", ["walk_1", "walk_2", "happy", "injured_1", "sleep_1"]]])),
    () => 0,
    clock.nowMs,
  )
  controller.dispatch(partnerChanged({ sprite: "pet", isDigitama: false }))
  controller.dispatch({ kind: "mood_changed", mood: "sad" })
  controller.dispatch({ kind: "adventure_changed", active: true })
  expect(frameContent(controller.output())).toBe("pet:walk_1")
  clock.set(MONSTER_SLEEP_AFTER_MS * 2)
  for (let index = 0; index < 20; index++) {
    const frame = controller.dispatch({ kind: "tick" })
    expect(frame.kind).toBe("walking")
    expect(frame.facing).toBe("right")
    expect(frame.offset).toBe(0)
    expect(frameContent(frame)).toBe(index % 2 === 0 ? "pet:walk_2" : "pet:walk_1")
  }
  controller.dispatch({ kind: "adventure_changed", active: false })
  expect(frameContent(controller.output())).toBe("pet:injured_1")
})
