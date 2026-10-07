import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { FIELDS } from "../src/data/fields.ts"
import { REGIONS, LOCATIONS } from "../src/data/regions.ts"
import {
  DEFAULT_WORLD_VISIT,
  auditHabitatCoverage,
  getRegion,
  getRegionLocations,
  getRegionProgress,
  getRegionResidents,
  getResidentRegions,
  isWorldVisit,
  resolveWorldVisit,
} from "../src/application/world.ts"

describe("Digital World catalog", () => {
  it("assigns the entire shared catalog and detects new unclassified species", () => {
    expect(auditHabitatCoverage(DIGIMON_CATALOG)).toEqual({
      total: DIGIMON_CATALOG.nodes.length,
      assigned: DIGIMON_CATALOG.nodes.length,
      unassignedIds: [],
      invalidIds: [],
    })
    const newNode = { ...DIGIMON_CATALOG.nodes[0]!, id: "future-species" }
    const expanded = { ...DIGIMON_CATALOG, nodes: [...DIGIMON_CATALOG.nodes, newNode] }
    expect(auditHabitatCoverage(expanded).unassignedIds).toEqual([newNode.id])
    expect(getResidentRegions(newNode.id)).toEqual([])
    expect(getResidentRegions("0-001").map((region) => region.id)).toEqual(["village-of-beginnings"])
  })
  it("activates exactly the ten requested classic fields and destinations", () => {
    expect(REGIONS.map((region) => region.name)).toEqual([
      "Gear Savannah",
      "Digital Ocean",
      "Wasteland",
      "Digital Forest",
      "Digital City",
      "Village of Beginnings",
      "Ancient Dino Region",
      "Tropical Jungle",
      "Vamdemon Castle",
      "Upside-Down Pyramid",
    ])
    expect(FIELDS).toHaveLength(10)
    expect(new Set(REGIONS.map((region) => region.fieldId)).size).toBe(10)
    expect(new Set(REGIONS.map((region) => region.id)).size).toBe(10)
    for (const region of REGIONS) expect(FIELDS.some((field) => field.id === region.fieldId)).toBe(true)
  })
  it("keeps the lake as an additional location and preserves the initial setting", () => {
    expect(LOCATIONS).toHaveLength(11)
    expect(getRegionLocations("digital-ocean").map((place) => place.name)).toEqual(["Digital Ocean", "Dragon Eye Lake"])
    expect(isWorldVisit(DEFAULT_WORLD_VISIT)).toBe(true)
    for (const region of REGIONS)
      expect(isWorldVisit({ regionId: region.id, locationId: region.defaultLocationId })).toBe(true)
  })
  it("rejects invalid or mismatched destinations, including persisted values", () => {
    for (const invalid of [
      null,
      [],
      {},
      { regionId: "digital-city", locationId: "dragon-eye-lake" },
      { regionId: "unknown", locationId: "unknown" },
    ]) {
      expect(isWorldVisit(invalid)).toBe(false)
      expect(resolveWorldVisit(invalid)).toEqual(DEFAULT_WORLD_VISIT)
    }
    expect(() => getRegion("not-a-region")).toThrow()
    expect(resolveWorldVisit({ ...DEFAULT_WORLD_VISIT, unwanted: "data" })).toEqual(DEFAULT_WORLD_VISIT)
  })
  it("resolves every curated inhabitant to a real catalog node without duplicate IDs", () => {
    for (const region of REGIONS) {
      const residents = getRegionResidents(region.id, DIGIMON_CATALOG)
      expect(residents.length).toBeGreaterThan(0)
      expect(new Set(residents.map((node) => node.id)).size).toBe(residents.length)
      for (const node of residents)
        expect(getResidentRegions(node.id).some((candidate) => candidate.id === region.id)).toBe(true)
    }
  })
  it("counts existing registrations without changing them and allows shared habitats", () => {
    const ocean = getRegion("digital-ocean")
    const registered = new Set([ocean.residentIds[0]!, "0-001", "missing"])
    const before = [...registered]
    expect(getRegionProgress(ocean.id, registered)).toEqual({ registered: 1, total: ocean.residentIds.length })
    expect([...registered]).toEqual(before)
    expect(DIGIMON_CATALOG.nodes.some((node) => getResidentRegions(node.id).length > 1)).toBe(true)
  })
  it("ships a pixel landscape for every location", () => {
    for (const location of LOCATIONS)
      expect(existsSync(new URL(`../assets/scenes/${location.scene}.svg`, import.meta.url))).toBe(true)
    expect(existsSync(new URL("../assets/backgrounds/dragon-eye-lake.png", import.meta.url))).toBe(true)
  })
})
