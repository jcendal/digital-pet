import { describe, expect, it } from "bun:test"
import {
  advanceLandscape,
  landscapeDirection,
  landscapeMotionEnabled,
  type SceneMotion,
  sceneMotionFor,
} from "../../../src/shared/scene-motion.ts"

const left: SceneMotion = { walking: true, offset: 0, facing: "left", partnerKey: "agumon:false", columns: 40 }

describe("walking landscape", () => {
  it("respects reduced motion unless the user explicitly turns the effect on", () => {
    expect(landscapeMotionEnabled(null, true)).toBe(false)
    expect(landscapeMotionEnabled(null, false)).toBe(true)
    expect(landscapeMotionEnabled("on", true)).toBe(true)
    expect(landscapeMotionEnabled("off", false)).toBe(false)
    expect(landscapeMotionEnabled("invalid", true)).toBe(false)
  })
  it("scrolls opposite actual steps and pauses between them", () => {
    expect(landscapeDirection(left, { ...left, offset: -1 })).toBe(1)
    expect(landscapeDirection(left, { ...left, offset: 1, facing: "right" })).toBe(-1)
    expect(landscapeDirection(left, left)).toBe(0)
    expect(landscapeDirection(left, { ...left, offset: -1, walking: false })).toBe(0)
    expect(landscapeDirection({ ...left, walking: false }, left)).toBe(0)
    expect(landscapeDirection(undefined, left)).toBe(0)
  })
  it("ignores position resets that contradict the walking pose", () => {
    expect(landscapeDirection({ ...left, offset: -5 }, left)).toBe(0)
    expect(landscapeDirection({ ...left, offset: 5, facing: "right" }, { ...left, facing: "right" })).toBe(0)
  })
  it("does not mistake a new pet or resized viewport for walking", () => {
    expect(landscapeDirection(left, { ...left, offset: -5, partnerKey: "gabumon:false" })).toBe(0)
    expect(landscapeDirection(left, { ...left, offset: -5, columns: 32 })).toBe(0)
    expect(
      sceneMotionFor(
        { kind: "digitama", result: { kind: "frame", frame: { content: "█" } }, offset: 0, facing: "left" },
        "egg:true",
        40,
      ).walking,
    ).toBe(false)
  })
  it("moves slowly and wraps at an equivalent reflected tile without exposing edges", () => {
    expect(advanceLandscape(0, 1, 100, 50)).toBeCloseTo(0.3)
    expect(advanceLandscape(0, -1, 100, 50)).toBeCloseTo(-0.3)
    expect(advanceLandscape(49.9, 1, 100, 50)).toBeCloseTo(-49.8)
    expect(advanceLandscape(-49.9, -1, 100, 50)).toBeCloseTo(49.8)
    expect(advanceLandscape(12, 0, 100, 50)).toBe(12)
    expect(advanceLandscape(12, 1, 100, 0)).toBe(12)
    expect(advanceLandscape(0, 1, 60_000, 50)).toBeCloseTo(0.3)
  })
})

it("scrolls the landscape opposite the pet during adventures, including stationary walking poses", () => {
  expect(landscapeDirection(undefined, { ...left, adventuring: true, facing: "right" })).toBe(-1)
  expect(landscapeDirection(left, { ...left, adventuring: true, facing: "left" })).toBe(1)
  expect(advanceLandscape(0, -1, 100, 320, 60)).toBe(-6)
})
