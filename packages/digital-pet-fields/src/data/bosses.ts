import type { BossVictory } from "@jcendal/digital-pet-core/domain/boss-victory.ts"
import type { RegionDifficulty } from "../domain/world.ts"

export const REGION_BOSS_TIERS = Object.freeze({ easy: [5, 6], medium: [6, 6], hard: [7, 7] } as const)
export const REGION_DIFFICULTIES: Readonly<Record<string, RegionDifficulty>> = Object.freeze({
  "village-of-beginnings": "easy",
  "gear-savannah": "easy",
  "digital-ocean": "easy",
  "digital-forest": "medium",
  "digital-city": "medium",
  "ancient-dino-region": "medium",
  "tropical-jungle": "medium",
  wasteland: "hard",
  "vamdemon-castle": "hard",
  "upside-down-pyramid": "hard",
})

/** Authored regional objectives; aliases preserve victories and pending fights from previous releases. */
export const REGION_BOSS_SLOTS = Object.freeze({
  "gear-savannah": [
    { nodeId: "5-039", legacyIds: ["5-039"] },
    { nodeId: "6-090", legacyIds: ["6-090"] },
  ],
  "digital-ocean": [
    { nodeId: "5-082", legacyIds: ["6-095"] },
    { nodeId: "6-017", legacyIds: ["6-017"] },
  ],
  wasteland: [
    { nodeId: "7-011", legacyIds: ["5-126"] },
    { nodeId: "7-031", legacyIds: ["6-014"] },
  ],
  "digital-forest": [
    { nodeId: "6-113", legacyIds: ["6-113"] },
    { nodeId: "6-077", legacyIds: ["6-077"] },
  ],
  "digital-city": [
    { nodeId: "6-080", legacyIds: ["6-080"] },
    { nodeId: "6-049", legacyIds: ["6-049"] },
  ],
  "village-of-beginnings": [
    { nodeId: "5-069", legacyIds: ["4-028"] },
    { nodeId: "6-128", legacyIds: ["5-067"] },
  ],
  "ancient-dino-region": [
    { nodeId: "6-138", legacyIds: ["5-106"] },
    { nodeId: "6-045", legacyIds: ["6-045"] },
  ],
  "tropical-jungle": [
    { nodeId: "6-103", legacyIds: ["6-103"] },
    { nodeId: "6-097", legacyIds: ["6-097"] },
  ],
  "vamdemon-castle": [
    { nodeId: "7-007", legacyIds: ["5-098"] },
    { nodeId: "7-025", legacyIds: ["6-141"] },
  ],
  "upside-down-pyramid": [
    { nodeId: "7-027", legacyIds: ["6-107"] },
    { nodeId: "7-044", legacyIds: ["6-079"] },
  ],
} satisfies Record<string, readonly { nodeId: string; legacyIds: readonly string[] }[]>)

const slotsFor = (regionId: string) => REGION_BOSS_SLOTS[regionId as keyof typeof REGION_BOSS_SLOTS] ?? []
export const REGION_BOSS_IDS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(Object.entries(REGION_BOSS_SLOTS).map(([id, slots]) => [id, slots.map((slot) => slot.nodeId)])),
)
export const legacyRegionBossIds = (regionId: string): readonly string[] => [
  ...new Set(slotsFor(regionId).flatMap((slot) => slot.legacyIds)),
]
export const isRegionalBossId = (regionId: string, nodeId: string): boolean =>
  slotsFor(regionId).some((slot) => slot.nodeId === nodeId || slot.legacyIds.includes(nodeId))
export const defeatedBossSlot = (regionId: string, index: number, victories: readonly BossVictory[]): boolean => {
  const slot = slotsFor(regionId)[index]
  return Boolean(
    slot &&
      victories.some(
        (victory) =>
          victory.regionId === regionId && (slot.nodeId === victory.nodeId || slot.legacyIds.includes(victory.nodeId)),
      ),
  )
}
