import { describe, expect, test } from "bun:test"
import { MonsterFrame, MonsterFrameCatalog } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { prepareExchangeArtwork, renderExchangeScene } from "../src/sequences/partner-exchange.ts"

const catalog = new MonsterFrameCatalog([
  [
    "one",
    [
      ["walk_1", new MonsterFrame("   ██\n  ████\n  ▀  ▀")],
      ["walk_2", new MonsterFrame("   ██\n  ████\n  ▀▀▀▀")],
    ],
  ],
  [
    "two",
    [
      ["walk_1", new MonsterFrame("   ▄▄\n  █  █\n  ▀▀▀▀")],
      ["happy", new MonsterFrame("  ▀▄▄▀\n  ████\n   ▀▀")],
    ],
  ],
])
const art = prepareExchangeArtwork(catalog, "one", "two")

describe("exchange choreography", () => {
  test("keeps every source pixel through gathering, crossing and reconstruction", () => {
    for (const time of [700, 1000, 1500, 2000, 2599, 2600, 3000, 3699]) {
      const frame = renderExchangeScene(art, time)
      expect(frame.incoming).toHaveLength(art.incoming.walk_1.length)
      if (time < 2600) expect(frame.outgoing).toHaveLength(art.outgoing.walk_1.length)
      for (const p of [...frame.incoming, ...frame.outgoing]) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
        expect(p.size).toBeGreaterThanOrEqual(1)
        expect(p.size).toBeLessThanOrEqual(2)
      }
    }
  })
  test("does not teleport at packing, crossing or arrival boundaries", () => {
    for (const boundary of [700, 1500, 2600]) {
      const before = renderExchangeScene(art, boundary - 0.01)
      const after = renderExchangeScene(art, boundary)
      for (const layer of ["incoming", "outgoing"] as const) {
        expect(after[layer]).toHaveLength(before[layer].length)
        after[layer].forEach((pixel, i) => {
          const previous = before[layer][i]
          if (!previous) throw new Error("Missing source pixel")
          expect(Math.abs(pixel.x - previous.x)).toBeLessThan(0.01)
          expect(Math.abs(pixel.y - previous.y)).toBeLessThan(0.01)
        })
      }
    }
  })
  test("finishes on the received happy pose with no outgoing pixels or lingering effects", () => {
    const final = renderExchangeScene(art, 4800)
    expect(final.phase).toBe("complete")
    expect(final.revealed).toBe(true)
    expect(final.incoming).toHaveLength(art.incoming.happy.length)
    expect(final.outgoing).toHaveLength(0)
    expect(final.trail).toHaveLength(0)
    expect(final.sparks).toHaveLength(0)
    expect(renderExchangeScene(art, 10000)).toEqual(final)
  })
  test("reduced motion uses static poses and settles without travel or particles", () => {
    for (const time of [0, 200, 400, 600]) {
      const frame = renderExchangeScene(art, time, true)
      expect(frame.trail).toHaveLength(0)
      expect(frame.sparks).toHaveLength(0)
      expect(frame.incoming.every((p) => p.size === 2)).toBe(true)
    }
    expect(renderExchangeScene(art, 600, true).phase).toBe("complete")
    expect(renderExchangeScene(art, 600, true).incoming).toEqual(renderExchangeScene(art, 4800).incoming)
  })
})
