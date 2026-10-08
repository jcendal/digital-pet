import { describe, expect, it } from "bun:test"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { getRegion } from "@jcendal/digital-pet-fields/application/world.ts"
import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { renderWorldRegion } from "@jcendal/digital-pet-webviews/panels/world/world-render.ts"
import { artworkToCenteredPixelArt } from "@jcendal/digital-pet-webviews/shared/pixel-artwork.ts"
import { advanceLocalPet, beginNewPartner } from "../src/local-progress.ts"
import { parsePetTransfer } from "../src/transfer-protocol.ts"

const worldVisit = { regionId: "digital-city", locationId: "digital-city" }
const createdAt = new Date(Date.now() - 600_000).toISOString()
const state = {
  partnerId: "sample",
  createdAt,
  currentNodeId: "0-001",
  gauge: 0,
  isTerminal: false,
  lastTickAt: Date.parse(createdAt),
  events: [{ currentNodeId: "0-001", createdAt }],
  worldVisit,
}

describe("web world integration", () => {
  it("centers visible sprite pixels without stretching smaller species", () => {
    const art = artworkToCenteredPixelArt("  ▄\n   ▀")
    expect(art.path).toBe("M2 1h1v1h-1zM3 2h1v1h-1z")
    expect(art.viewBox).toBe("-13 -14 32 32")
    expect(artworkToCenteredPixelArt("   ")).toEqual({ path: "", viewBox: "0 0 32 32" })
  })
  it("shows five guide cards before a closed, keyboard-accessible disclosure", () => {
    const region = getRegion("digital-ocean")
    const model = buildWorldPanelModel(region.id, { kind: "empty" }, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
    const html = renderWorldRegion(region, model, { regionId: region.id, locationId: "dragon-eye-lake" })
    const [preview, remainder] = html.split('<details class="resident-more">')
    expect(preview!.match(/class="resident-row"/g)).toHaveLength(5)
    expect(remainder!.match(/class="resident-row"/g)).toHaveLength(model.residents.length - 5)
    expect(remainder).toContain(`<summary><span class="residents-expand">SHOW ${model.residents.length - 5} MORE`)
    expect(html).not.toContain('<details class="resident-more" open')
    expect(html).not.toContain("SHOW LESS")
    const short = renderWorldRegion(
      region,
      { ...model, residents: model.residents.slice(0, 5) },
      { regionId: region.id, locationId: "dragon-eye-lake" },
    )
    expect(short).not.toContain("<details")
    expect(short.match(/class="resident-row"/g)).toHaveLength(5)
  })
  it("keeps species without supplied sprites visible using a labelled placeholder", () => {
    const region = getRegion("village-of-beginnings")
    const model = buildWorldPanelModel(region.id, { kind: "empty" }, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
    expect(model.residents.some((resident) => resident.id === "2-033" && resident.artwork === "")).toBe(true)
    const html = renderWorldRegion(region, model, { regionId: region.id, locationId: region.defaultLocationId })
    expect(html).toContain('aria-label="Artwork unavailable"')
    expect(html).toContain("Minomon")
  })
  it("transfers the destination and keeps older saves compatible", () => {
    expect(parsePetTransfer({ version: 1, state }).state.worldVisit).toEqual(worldVisit)
    const { worldVisit: _visit, ...legacy } = state
    expect(parsePetTransfer({ version: 1, state: legacy }).state.worldVisit).toBeUndefined()
    expect(() =>
      parsePetTransfer({
        version: 1,
        state: { ...state, worldVisit: { regionId: "digital-ocean", locationId: "digital-city" } },
      }),
    ).toThrow("invalid destination")
  })
  it("keeps the place when starting a new egg and does not alter progression", () => {
    expect(beginNewPartner(state, "next", Date.now()).worldVisit).toEqual(worldVisit)
    const other = { ...state, worldVisit: { regionId: "digital-ocean", locationId: "dragon-eye-lake" } }
    const a = advanceLocalPet(state, state.lastTickAt + 24 * 300_000, () => 0)
    const b = advanceLocalPet(other, state.lastTickAt + 24 * 300_000, () => 0)
    expect(a.currentNodeId).toBe(b.currentNodeId)
    expect(a.gauge).toBe(b.gauge)
    expect(a.events).toEqual(b.events)
  })
  it("builds a public guide while marking only actual discoveries", () => {
    const residentId = getRegion("digital-ocean").residentIds[0]!
    const events = [{ eventId: "1", currentNodeId: residentId, createdAt }]
    const archive = {
      kind: "available" as const,
      partners: [
        { partnerId: "previous", generation: 1, createdAt, retiredAt: createdAt, events },
        { partnerId: "sample", generation: 2, createdAt, retiredAt: null, events },
      ],
    }
    const model = buildWorldPanelModel("digital-ocean", archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
    expect(model.registeredIds).toEqual([residentId])
    expect(model.residents.length).toBeGreaterThan(0)
    expect(model.residents.every((resident) => resident.name.length > 0)).toBe(true)
    expect(model.residents.some((resident) => resident.artwork.length > 0)).toBe(true)
    expect(model.residents.filter((resident) => resident.registered).map((resident) => resident.id)).toEqual([
      residentId,
    ])
    expect(archive.partners[0]!.events).toEqual(events)
  })
})
