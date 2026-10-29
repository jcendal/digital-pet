import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import identities from "@jcendal/digital-pet-core/data/color-sprite-identities.json"
import { MONSTER_FRAME_CATALOG, MONSTER_FRAME_NAMES } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import manifest from "../assets/themes/color/catalog.json"
import { resolveMonsterVisual } from "../src/themes/monster-visuals.ts"
import { decodePixelRuns } from "../src/themes/pixel-frame.ts"
import { resolveVisualTheme } from "../src/themes/theme.ts"

test("the generated color import covers existing save identities without replacing the roster", () => {
  expect(Object.keys(identities.nodes).sort()).toEqual(DIGIMON_CATALOG.nodes.map((node) => node.id).sort())
  expect(manifest.identities).toBe(650)
  for (const node of DIGIMON_CATALOG.nodes) {
    for (const pose of MONSTER_FRAME_NAMES) {
      const result = resolveMonsterVisual("color", node.id, pose)
      if (result.kind !== "frame") throw new Error(`Missing ${node.id}:${pose}`)
      expect(result.frame.pixels).toHaveLength(256)
      expect(result.frame.palette[0]).toBeNull()
      expect(result.frame.pixels.some((index) => index > 0)).toBe(true)
    }
  }
  expect(resolveMonsterVisual("color", "not-a-node", "walk_1").kind).toBe("unavailable")
  expect(resolveMonsterVisual("color", "__proto__", "walk_1").kind).toBe("unavailable")
})

test("variant decisions retain classic Greymon, both Whamon stages and legacy aliases", () => {
  expect(identities.nodes["4-054"].sprite).toBe("greymon-vaccine")
  expect(identities.nodes["4-141"].sprite).toBe("whamon-champion")
  expect(identities.nodes["5-141"].sprite).toBe("whamon-perfect")
  expect(identities.nodes["5-086"].sprite).toBe(identities.nodes["5-087"].sprite)
  expect(identities.nodes["5-033"].sprite).toBe("donedevimon")
  expect(identities.nodes["2-033"].sprite).toBe("minomon")
  expect(identities.nodes["5-146"].sprite).toBe(identities.nodes["5-034"].sprite)
})

test("reaction substitutions and egg idle fallbacks remain explicit to consumers", () => {
  expect(resolveMonsterVisual("color", "3-001", "attack")).toMatchObject({
    sourcePose: "attack_1",
    substitution: "none",
  })
  expect(resolveMonsterVisual("color", "3-001", "injured_1")).toMatchObject({
    sourcePose: "sick",
    substitution: "same-species-reaction",
  })
  expect(resolveMonsterVisual("color", "3-001", "injured_2")).toMatchObject({
    sourcePose: "refuse",
    substitution: "same-species-reaction",
  })
  expect(resolveMonsterVisual("color", "0-001", "happy")).toMatchObject({
    sourcePose: "walk_1",
    substitution: "same-species-idle",
  })
  expect(resolveMonsterVisual("lcd", "2-033", "walk_1").kind).toBe("unavailable")
})

test("every available LCD pose preserves its original occupied cells and missing-art status", () => {
  for (const node of DIGIMON_CATALOG.nodes) {
    for (const pose of MONSTER_FRAME_NAMES) {
      const original = MONSTER_FRAME_CATALOG.get(node.sprite, pose)
      const visual = resolveMonsterVisual("lcd", node.id, pose)
      if (!original) {
        expect(visual.kind).toBe("unavailable")
        continue
      }
      if (visual.kind !== "frame") throw new Error(`Missing LCD frame ${node.id}:${pose}`)
      const rows = original.content.split("\n")
      for (let y = 0; y < 16; y += 1)
        for (let x = 0; x < 16; x += 1) {
          const cell = rows[Math.floor(y / 2)]?.[x]
          expect(visual.frame.pixels[y * 16 + x]).toBe(cell === "█" || cell === (y % 2 ? "▄" : "▀") ? 1 : 0)
        }
    }
  }
})

test("theme/frame caches remain independent and do not decode the same pose twice", () => {
  const color = resolveMonsterVisual("color", "3-001", "walk_1")
  const again = resolveMonsterVisual("color", "3-001", "walk_1")
  const lcd = resolveMonsterVisual("lcd", "3-001", "walk_1")
  if (color.kind !== "frame" || again.kind !== "frame" || lcd.kind !== "frame") throw new Error("Missing fixture")
  expect(color.frame).toBe(again.frame)
  expect(color.frame).not.toBe(lcd.frame)
  expect(color.frame.palette.length).toBeGreaterThan(2)
  expect(lcd.frame.palette).toEqual([null, resolveVisualTheme("lcd").tokens.ink])
  expect(resolveVisualTheme(null)).toBe(resolveVisualTheme("lcd"))
})

test("all generated source poses decode and the bundled snapshot matches its manifest", async () => {
  const file = Bun.file(new URL("../assets/themes/color/generated/monsters.json", import.meta.url))
  const bytes = new Uint8Array(await file.arrayBuffer())
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(manifest.dataSha256)
  expect(bytes.length).toBe(manifest.dataBytes)
  const data: { sprite: string; palette: (string | null)[]; frames: Record<string, string> }[] = await file.json()
  expect(data.length).toBe(manifest.sprites)
  let poses = 0
  for (const sprite of data) {
    for (const encoded of Object.values(sprite.frames)) {
      const frame = decodePixelRuns(16, 16, sprite.palette, encoded)
      expect(frame.pixels.some((index) => index > 0)).toBe(true)
      poses += 1
    }
  }
  expect(poses).toBe(manifest.poses)
})
