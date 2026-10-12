export const FIELD_IDS = [
  "nature-spirits",
  "deep-savers",
  "nightmare-soldiers",
  "wind-guardians",
  "metal-empire",
  "virus-busters",
  "dragons-roar",
  "jungle-troopers",
  "dark-area",
  "unknown",
] as const
export type FieldId = (typeof FIELD_IDS)[number]
export type SceneId =
  | "savannah"
  | "beach"
  | "wasteland"
  | "forest"
  | "city"
  | "village"
  | "dino"
  | "jungle"
  | "castle"
  | "pyramid"
  | "lake"
  | "swamp"
  | "cemetery"
  | "panorama"
  | "factory"
  | "ice"
  | "canyon"
  | "mangrove"
  | "terminal"
  | "toys"

export type Field = {
  readonly id: FieldId
  readonly name: string
  readonly code: string
  readonly description: string
}
export type WorldLocation = {
  readonly id: string
  readonly name: string
  readonly regionId: string
  readonly scene: SceneId
  readonly backgroundFile: string
  readonly atmosphere: readonly [string, string]
}
export type Region = {
  readonly id: string
  readonly name: string
  readonly fieldId: FieldId
  readonly description: string
  readonly defaultLocationId: string
  readonly residentIds: readonly string[]
}
export type WorldVisit = { readonly regionId: string; readonly locationId: string }

/** Persistence is owned by a host; the world package never reads a browser or database. */
export interface WorldVisitStore {
  load(): Promise<WorldVisit>
  save(visit: WorldVisit): Promise<void>
}
