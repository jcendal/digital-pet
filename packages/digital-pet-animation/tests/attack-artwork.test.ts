import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import reference from "@jcendal/digital-pet-core/data/attack-assignments.json"
import { ATTACK_ASSIGNMENTS } from "@jcendal/digital-pet-core/data/attack-assignments.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { ATTACK_ARTWORK, attackArtworkForSprite } from "../src/sequences/attack-artwork.ts"

test("all 109 Pendulum projectiles retain their source pixels, local files and checksums", async () => {
  const penog = ATTACK_ARTWORK.filter((frame) => frame.set === "penog")
  expect(penog.map((frame) => frame.index)).toEqual(Array.from({ length: 109 }, (_, index) => index))
  await Promise.all(
    ATTACK_ARTWORK.map(async (frame) => {
      const bytes = await Bun.file(new URL(`../assets/attacks/${frame.file}`, import.meta.url)).arrayBuffer()
      expect(createHash("sha256").update(new Uint8Array(bytes)).digest("hex")).toBe(frame.sha256)
      expect(frame.content.split("\n")).toHaveLength(4)
      for (const row of frame.content.split("\n")) expect(row).toHaveLength(8)
      expect(frame.content.trim()).not.toBe("")
    }),
  )
})

test("every assigned species has a matching imported projectile and an intact game ID", () => {
  const unavailable = reference.unavailable.map((row) => row.nodeId)
  expect(new Set([...ATTACK_ASSIGNMENTS.keys(), ...unavailable]).size).toBe(DIGIMON_CATALOG.nodes.length)
  for (const id of unavailable) {
    expect(DIGIMON_CATALOG.byId.has(id)).toBe(true)
    expect(ATTACK_ASSIGNMENTS.has(id)).toBe(false)
  }
  for (const [id, assignment] of ATTACK_ASSIGNMENTS) {
    const node = DIGIMON_CATALOG.byId.get(id)
    if (!node) throw new Error(`Unknown species ${id}`)
    expect(ATTACK_ARTWORK.some((frame) => frame.set === assignment.set && frame.index === assignment.index)).toBe(true)
    expect(attackArtworkForSprite(node.sprite, "right")).toBeDefined()
    expect(assignment.source).toStartWith("https://digimon-db.omnipet.app.br/api/gathering/")
  }
})

test("resolved indices stay zero based and facing follows the firing side", () => {
  expect(ATTACK_ASSIGNMENTS.get("3-001")).toMatchObject({ module: "penog", set: "penog", index: 1 })
  expect(ATTACK_ASSIGNMENTS.get("4-060")).toBeDefined()
  const frame = ATTACK_ARTWORK.find((frame) => frame.set === "penog" && frame.index === 1)
  if (!frame) throw new Error("Missing Pendulum projectile 1")
  const right = frame.content.split("\n")
  expect(attackArtworkForSprite("agumon", "right")).toEqual(right)
  expect(attackArtworkForSprite("agumon", "left")).toEqual(right.map((row) => Array.from(row).reverse().join("")))
  expect(attackArtworkForSprite("missing-species", "right")).toBeUndefined()
  expect(attackArtworkForSprite("egg", "right")).toBeUndefined()
})
