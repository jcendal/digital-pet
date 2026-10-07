import type { DigimonCatalog, DigimonNode } from "@jcendal/digital-pet-core/domain/digimon-node.ts"
import { FIELDS } from "../data/fields.ts"
import { LOCATIONS, REGIONS } from "../data/regions.ts"
import type { Field, Region, WorldLocation, WorldVisit } from "../domain/world.ts"

export const DEFAULT_WORLD_VISIT: WorldVisit = Object.freeze({
  regionId: "digital-ocean",
  locationId: "dragon-eye-lake",
})

export const getRegion = (id: string): Region => {
  const region = REGIONS.find((region) => region.id === id)
  if (!region) throw new Error(`Unknown region: ${id}`)
  return region
}
export const getLocation = (id: string): WorldLocation => {
  const location = LOCATIONS.find((location) => location.id === id)
  if (!location) throw new Error(`Unknown location: ${id}`)
  return location
}
export const getField = (region: Region): Field => {
  const field = FIELDS.find((field) => field.id === region.fieldId)
  if (!field) throw new Error(`Unknown field: ${region.fieldId}`)
  return field
}
export const getRegionLocations = (regionId: string): readonly WorldLocation[] =>
  LOCATIONS.filter((location) => location.regionId === getRegion(regionId).id)

export const isWorldVisit = (value: unknown): value is WorldVisit => {
  if (typeof value !== "object" || value === null || !("regionId" in value) || !("locationId" in value)) return false
  return (
    REGIONS.some((region) => region.id === value.regionId) &&
    LOCATIONS.some((location) => location.id === value.locationId && location.regionId === value.regionId)
  )
}
export const resolveWorldVisit = (value: unknown): WorldVisit =>
  isWorldVisit(value) ? { regionId: value.regionId, locationId: value.locationId } : DEFAULT_WORLD_VISIT

export const getRegionResidents = (regionId: string, catalog: DigimonCatalog): readonly DigimonNode[] =>
  getRegion(regionId).residentIds.map((id) => {
    const node = catalog.byId.get(id)
    if (!node) throw new Error(`Unknown resident ${id} in ${regionId}`)
    return node
  })
export const getResidentRegions = (nodeId: string): readonly Region[] =>
  REGIONS.filter((region) => region.residentIds.includes(nodeId))

export const getRegionProgress = (regionId: string, registeredIds: ReadonlySet<string>) => {
  const region = getRegion(regionId)
  return {
    registered: region.residentIds.filter((id) => registeredIds.has(id)).length,
    total: region.residentIds.length,
  }
}

/** Exposes omissions and stale assignments when the shared species catalog changes. */
export const auditHabitatCoverage = (catalog: DigimonCatalog) => {
  const assigned = new Set(REGIONS.flatMap((region) => region.residentIds))
  return {
    total: catalog.nodes.length,
    assigned: catalog.nodes.filter((node) => assigned.has(node.id)).length,
    unassignedIds: catalog.nodes.filter((node) => !assigned.has(node.id)).map((node) => node.id),
    invalidIds: [...assigned].filter((id) => !catalog.byId.has(id)),
  }
}
