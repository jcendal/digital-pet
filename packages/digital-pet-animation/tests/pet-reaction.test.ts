import { expect, test } from "bun:test"
import { MONSTER_SLEEP_AFTER_MS } from "../src/constants/presentation-timing.ts"
import { MonsterAnimationController } from "../src/idle/monster-animation.ts"
import { catalogFor, controlledClock, frameContent, partnerChanged } from "./monster-animation-test-utils.ts"

test("petting smiles briefly at the same position, then restores the hygiene mood", () => {
  const controller = new MonsterAnimationController(
    catalogFor(new Map([["pet", ["walk_1", "walk_2", "happy", "injured_1"]]])),
    () => 0.5,
    controlledClock().nowMs,
  )
  controller.dispatch(partnerChanged({ sprite: "pet", isDigitama: false }))
  controller.dispatch({ kind: "viewport_resized", width: 40 })
  controller.dispatch({ kind: "mood_changed", mood: "sad" })
  const before = controller.output()
  const petted = controller.dispatch({ kind: "pet" })
  expect(petted.reaction).toBe("happy")
  expect(frameContent(petted)).toBe("pet:happy")
  expect(petted.offset).toBe(before.offset)
  expect(petted.facing).toBe(before.facing)
  expect(frameContent(controller.dispatch({ kind: "tick" }))).toBe("pet:happy")
  const resumed = controller.dispatch({ kind: "tick" })
  expect(resumed.reaction).toBeUndefined()
  expect(frameContent(resumed)).toBe("pet:injured_1")
})

test("a sleeping pet wakes angry, with a sad fallback for sprites without anger", () => {
  for (const frame of ["angry", "injured_1", "refuse"] as const) {
    const clock = controlledClock()
    const controller = new MonsterAnimationController(
      catalogFor(new Map([["pet", ["walk_1", "walk_2", "sleep_1", "happy", frame]]])),
      () => 0.5,
      clock.nowMs,
    )
    controller.dispatch(partnerChanged({ sprite: "pet", isDigitama: false }))
    clock.set(MONSTER_SLEEP_AFTER_MS)
    expect(controller.dispatch({ kind: "tick" }).kind).toBe("sleeping")
    const petted = controller.dispatch({ kind: "pet" })
    expect(petted.reaction).toBe("angry")
    expect(frameContent(petted)).toBe(`pet:${frame}`)
    controller.dispatch({ kind: "tick" })
    expect(controller.dispatch({ kind: "tick" }).kind).toBe("walking")
  }
})

test("sparse sprites keep a valid frame, while eggs and absent pets ignore cosmetic petting", () => {
  const controller = new MonsterAnimationController(catalogFor(new Map([["pet", ["walk_1"]]])))
  expect(controller.dispatch({ kind: "pet" }).reaction).toBeUndefined()
  controller.dispatch(partnerChanged({ sprite: "pet", isDigitama: true }))
  expect(controller.dispatch({ kind: "pet" }).reaction).toBeUndefined()
  controller.dispatch(partnerChanged({ sprite: "pet", isDigitama: false }))
  const petted = controller.dispatch({ kind: "pet" })
  expect(petted.reaction).toBe("happy")
  expect(frameContent(petted)).toBe("pet:walk_1")
  controller.dispatch(partnerChanged({ sprite: "missing", isDigitama: false }))
  expect(controller.dispatch({ kind: "pet" }).reaction).toBeUndefined()
})
