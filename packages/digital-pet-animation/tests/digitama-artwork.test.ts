import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { EGG_FAMILIES } from "@jcendal/digital-pet-core/data/egg-families.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { MonsterAnimationController } from "../src/idle/monster-animation.ts"
import {
  DIGITAMA_ARTWORK,
  digitamaArtworkForOrigin,
  withDigitamaOriginArtwork,
} from "../src/render/digitama-artwork.ts"

describe("imported Digitama artwork", () => {
  test("bundles the complete source export with verified local checksums and LCD frames", () => {
    expect(DIGITAMA_ARTWORK).toHaveLength(44)
    expect(new Set(DIGITAMA_ARTWORK.map((egg) => egg.name)).size).toBe(44)
    for (const egg of DIGITAMA_ARTWORK) {
      for (const frame of [egg, egg.alternate]) {
        if (!frame) continue
        const file = readFileSync(new URL(`../assets/digitamas/${frame.file}`, import.meta.url))
        expect(createHash("sha256").update(file).digest("hex")).toBe(frame.sha256)
        expect(frame.content.split("\n")).toHaveLength(8)
        expect(frame.content.split("\n").every((row) => row.length === 16)).toBe(true)
        expect(frame.content).toMatch(/[█▀▄]/)
      }
      if (egg.alternateReview) {
        const file = readFileSync(new URL(`../assets/digitamas/${egg.alternateReview.file}`, import.meta.url))
        expect(createHash("sha256").update(file).digest("hex")).toBe(egg.alternateReview.sha256)
        expect(egg.alternate).toBeNull()
      }
    }
    expect(new Set(EGG_FAMILIES.map((family) => digitamaArtworkForOrigin(family.id)?.path)).size).toBe(
      EGG_FAMILIES.length,
    )
    for (const family of EGG_FAMILIES) expect(digitamaArtworkForOrigin(family.id)?.alternate).toBeTruthy()
  })

  test("applies known origin art to eggs and preserves legacy eggs and other animation states", () => {
    const controller = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
    const egg = controller.dispatch({ kind: "partner_changed", partner: { sprite: "egg", isDigitama: true } })
    const styled = withDigitamaOriginArtwork(egg, "forest")
    const forest = digitamaArtworkForOrigin("forest")
    if (!forest?.alternate || styled.result.kind !== "frame") throw new Error("Missing imported egg frame")
    expect(styled.result.frame.content).toBe(forest.content)
    expect(styled.kind).toBe(egg.kind)
    expect(styled.offset).toBe(egg.offset)
    expect(styled.facing).toBe(egg.facing)
    const next = withDigitamaOriginArtwork(controller.dispatch({ kind: "tick" }), "forest")
    if (next.result.kind !== "frame") throw new Error("Missing animated egg frame")
    expect(next.result.frame.content).toBe(forest.alternate.content)
    expect(withDigitamaOriginArtwork(egg, undefined)).toBe(egg)
    expect(withDigitamaOriginArtwork(egg, "unknown")).toBe(egg)
    const walking = controller.dispatch({ kind: "partner_changed", partner: { sprite: "agumon", isDigitama: false } })
    expect(withDigitamaOriginArtwork(walking, "forest")).toBe(walking)
  })
})
