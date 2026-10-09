import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { getStageLabel } from "@jcendal/digital-pet-core/data/stages.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/domain/digimon-node.ts"
import { getRegionResidents } from "@jcendal/digital-pet-fields/application/world.ts"
import { artworkToCenteredPixelArt } from "../../shared/pixel-artwork.ts"

export type WorldResident = {
  readonly id: string
  readonly name: string
  readonly stage: string
  readonly artwork: string
  readonly artworkViewBox: string
  readonly registered: boolean
}
export type WorldPanelModel = {
  readonly registeredIds: readonly string[]
  readonly residents: readonly WorldResident[]
}

export const buildWorldPanelModel = (
  regionId: string,
  archive: DigitalPetArchiveResult,
  catalog: DigimonCatalog,
  settings: ResolvedDigitalPetSettings,
): WorldPanelModel => {
  const registeredIds = new Set(
    archive.kind === "available"
      ? archive.partners.flatMap((partner) => partner.events.map((event) => event.currentNodeId))
      : [],
  )
  return {
    registeredIds: [...registeredIds],
    residents: getRegionResidents(regionId, catalog).map((node) => {
      const art = artworkToCenteredPixelArt(MONSTER_FRAME_CATALOG.get(node.sprite, "walk_1")?.content ?? "")
      return {
        id: node.id,
        name: settings.language === "en" ? node.nameEn : node.nameJp,
        stage: getStageLabel(node.stage, settings.stageLabels[settings.language]),
        artwork: art.path,
        artworkViewBox: art.viewBox,
        registered: registeredIds.has(node.id),
      }
    }),
  }
}
