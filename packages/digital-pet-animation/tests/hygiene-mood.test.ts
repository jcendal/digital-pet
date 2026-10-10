import { expect, test } from "bun:test"
import { MonsterAnimationController } from "../src/idle/monster-animation.ts"
import { catalogFor, controlledClock, frameContent, partnerChanged } from "./monster-animation-test-utils.ts"

test("sad mood uses injured frames, cleaning uses happy, and neutral restores ordinary animation", () => {
  const controller = new MonsterAnimationController(
    catalogFor(new Map([["pet", ["walk_1", "walk_2", "injured_1", "injured_2", "happy"]]])),
    () => 0.5,
    controlledClock().nowMs,
  )
  controller.dispatch(partnerChanged({ sprite: "pet", isDigitama: false }))
  expect(frameContent(controller.dispatch({ kind: "mood_changed", mood: "sad" }))).toContain("injured_")
  expect(frameContent(controller.dispatch({ kind: "tick" }))).toContain("injured_")
  expect(frameContent(controller.dispatch({ kind: "mood_changed", mood: "happy" }))).toBe("pet:happy")
  expect(frameContent(controller.dispatch({ kind: "mood_changed", mood: "neutral" }))).toContain("walk_")
})

test("a sparse sprite falls back without crashing and eggs do not show hygiene moods", () => {
  const controller = new MonsterAnimationController(
    catalogFor(
      new Map([
        ["egg", ["walk_1", "happy"]],
        ["sparse", ["walk_1"]],
      ]),
    ),
    () => 0.5,
    controlledClock().nowMs,
  )
  controller.dispatch(partnerChanged({ sprite: "egg", isDigitama: true }))
  expect(frameContent(controller.dispatch({ kind: "mood_changed", mood: "happy" }))).toBe("egg:walk_1")
  controller.dispatch(partnerChanged({ sprite: "sparse", isDigitama: false }))
  expect(frameContent(controller.dispatch({ kind: "mood_changed", mood: "sad" }))).toBe("sparse:walk_1")
})
