import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { getStageLabel, getStageTranslationKey } from "@jcendal/digital-pet-core/data/stages.ts"
import type { BossVictory } from "@jcendal/digital-pet-core/domain/boss-victory.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/domain/digimon-node.ts"
import { getRegionBosses, getRegionResidents } from "@jcendal/digital-pet-fields/application/world.ts"
import { artworkToCenteredPixelArt } from "../../shared/pixel-artwork.ts"

export type WorldResident = {
  readonly id: string
  readonly name: string
  readonly stage: string
  readonly stageKey?: string
  readonly artwork: string
  readonly artworkViewBox: string
  readonly registered: boolean
}
export type WorldPanelModel = {
  readonly registeredIds: readonly string[]
  readonly residents: readonly WorldResident[]
  readonly bosses?: readonly (WorldResident & { readonly defeated: boolean })[]
  readonly bossVictories?: readonly BossVictory[]
}

export const buildWorldPanelModel = (
  regionId: string,
  archive: DigitalPetArchiveResult,
  catalog: DigimonCatalog,
  settings: ResolvedDigitalPetSettings,
  bossVictories: readonly BossVictory[] = [],
): WorldPanelModel => {
  const registeredIds = new Set(
    archive.kind === "available"
      ? archive.partners.flatMap((partner) => partner.events.map((event) => event.currentNodeId))
      : [],
  )
  const resident = (node: DigimonCatalog["nodes"][number]): WorldResident => {
    const art = artworkToCenteredPixelArt(MONSTER_FRAME_CATALOG.get(node.sprite, "walk_1")?.content ?? "")
    const stageKey = getStageTranslationKey(node.stage, settings.stageLabels[settings.language])
    return {
      id: node.id,
      name: settings.language === "en" ? node.nameEn : node.nameJp,
      stage: getStageLabel(node.stage, settings.stageLabels[settings.language]),
      ...(stageKey ? { stageKey } : {}),
      artwork: art.path,
      artworkViewBox: art.viewBox,
      registered: registeredIds.has(node.id),
    }
  }
  return {
    registeredIds: [...registeredIds],
    bossVictories,
    bosses: getRegionBosses(regionId, catalog).map((node) => ({
      ...resident(node),
      defeated: bossVictories.some((victory) => victory.regionId === regionId && victory.nodeId === node.id),
    })),
    residents: getRegionResidents(regionId, catalog).map(resident),
  }
}
