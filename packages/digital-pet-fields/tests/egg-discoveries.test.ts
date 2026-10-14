import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { EGG_FAMILIES } from "@jcendal/digital-pet-core/data/egg-families.ts"
import { discoveredEggFamilies, REGIONAL_EGG_DISCOVERIES } from "../src/data/egg-discoveries.ts"
import { REGIONS } from "../src/data/regions.ts"

test("every region has exactly one distinct egg with a valid first-stage hatch", () => {
  expect(EGG_FAMILIES).toHaveLength(REGIONS.length)
  expect(REGIONAL_EGG_DISCOVERIES).toHaveLength(REGIONS.length)
  expect(new Set(EGG_FAMILIES.map((family) => family.digitamaDesign)).size).toBe(REGIONS.length)
  expect(REGIONAL_EGG_DISCOVERIES.map((discovery) => discovery.regionId).sort()).toEqual(
    REGIONS.map((region) => region.id).sort(),
  )
  expect(REGIONAL_EGG_DISCOVERIES.map((discovery) => discovery.familyId).sort()).toEqual(
    EGG_FAMILIES.map((family) => family.id).sort(),
  )
  for (const family of EGG_FAMILIES) {
    for (const id of family.hatchIds) {
      const hatch = DIGIMON_CATALOG.byId.get(id)
      expect(hatch?.stage).toBe(1)
      expect(hatch?.nextEvolutions.length).toBeGreaterThan(0)
    }
  }
})

test("only the village egg starts unlocked; a regional boss victory unlocks only its own egg", () => {
  expect(discoveredEggFamilies([])).toEqual(["starter"])
  for (const discovery of REGIONAL_EGG_DISCOVERIES) {
    const victory = { regionId: discovery.regionId, nodeId: "legacy-boss", defeatedAt: "2026-10-14T00:00:00.000Z" }
    expect(discoveredEggFamilies([victory, victory])).toEqual(
      discovery.familyId === "starter" ? ["starter"] : ["starter", discovery.familyId],
    )
  }
  expect(
    discoveredEggFamilies([{ regionId: "invalid", nodeId: "boss", defeatedAt: "2026-10-14T00:00:00.000Z" }]),
  ).toEqual(["starter"])
  expect(
    discoveredEggFamilies(
      REGIONAL_EGG_DISCOVERIES.map((discovery) => ({
        regionId: discovery.regionId,
        nodeId: "boss",
        defeatedAt: "2026-10-14T00:00:00.000Z",
      })),
    ),
  ).toHaveLength(REGIONS.length)
})
