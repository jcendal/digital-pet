import type { BossVictory } from "@jcendal/digital-pet-core/domain/boss-victory.ts"

export const REGIONAL_EGG_DISCOVERIES = Object.freeze([
  { familyId: "starter", regionId: "village-of-beginnings" },
  { familyId: "savannah", regionId: "gear-savannah" },
  { familyId: "aquatic", regionId: "digital-ocean" },
  { familyId: "forest", regionId: "digital-forest" },
  { familyId: "machine", regionId: "digital-city" },
  { familyId: "dragon", regionId: "ancient-dino-region" },
  { familyId: "jungle", regionId: "tropical-jungle" },
  { familyId: "nightmare", regionId: "wasteland" },
  { familyId: "dark", regionId: "vamdemon-castle" },
  { familyId: "mystery", regionId: "upside-down-pyramid" },
] as const)

export const discoveredEggFamilies = (victories: readonly BossVictory[]): readonly string[] =>
  REGIONAL_EGG_DISCOVERIES.filter(
    (discovery) =>
      discovery.familyId === "starter" || victories.some((victory) => victory.regionId === discovery.regionId),
  ).map((discovery) => discovery.familyId)
