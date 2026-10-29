import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { EGG_FAMILIES } from "@jcendal/digital-pet-core/data/egg-families.ts"
import { defaultBattleScene } from "../src/sequences/evolution-battle-artwork.ts"
import { renderExchangeScene } from "../src/sequences/partner-exchange.ts"
import { colorArtworkScene, colorExchangeArtwork, colorMonsterFrame } from "../src/themes/color-scene.ts"

test("all regional eggs retain two native colored poses and distinct designs", () => {
  const designs = new Set<string>()
  for (const family of EGG_FAMILIES) {
    for (const pose of ["walk_1", "walk_2"] as const) {
      const frame = colorMonsterFrame("0-001", pose, family.id)!
      expect(frame.width).toBe(16)
      expect(frame.height).toBe(16)
      expect(frame.palette.length).toBeGreaterThan(2)
    }
    designs.add(JSON.stringify(colorMonsterFrame("0-001", "walk_1", family.id)))
  }
  expect(designs.size).toBe(10)
})

test("battle snapshot preserves both palettes, mirroring, projectile direction and score state", () => {
  const player = DIGIMON_CATALOG.byId.get("3-001")!
  const opponent = DIGIMON_CATALOG.byId.get("4-054")!
  const scene = defaultBattleScene({ shooter: "player", progress: 0.25, playerHits: 1, opponentHits: 2 })
  const frozen = JSON.stringify(scene)
  const output = colorArtworkScene(
    { kind: "battle", player: player.sprite, opponent: opponent.sprite, width: 60, scene },
    [player.id, opponent.id],
  )
  expect(output.layers).toHaveLength(3)
  expect(output.layers[0]!.facing).toBe("right")
  expect(output.layers[1]!.facing).toBe("left")
  expect(output.layers[0]!.frame.palette).not.toEqual(output.layers[1]!.frame.palette)
  expect(output.layers[2]!.frame.palette.length).toBeGreaterThan(2)
  expect(JSON.stringify(scene)).toBe(frozen)
})

test("exchange pixels keep source colors through packing, crossing and arrival", () => {
  const art = colorExchangeArtwork("3-001", "4-054")
  for (const time of [0, 1000, 2000, 3200, 4400]) {
    const frame = renderExchangeScene(art, time)
    expect(frame.incoming.length).toBeGreaterThan(0)
    expect(frame.incoming.every((pixel) => /^#[a-f0-9]{6}$/.test(pixel.color ?? ""))).toBe(true)
  }
})
