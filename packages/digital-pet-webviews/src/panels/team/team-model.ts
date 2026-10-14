import { digitamaArtworkForOrigin } from "@jcendal/digital-pet-animation/render/digitama-artwork.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { getStageLabel, getStageTranslationKey } from "@jcendal/digital-pet-core/data/stages.ts"
import type { Partner } from "@jcendal/digital-pet-core/domain/partner.ts"
import type { PartnerTeam } from "@jcendal/digital-pet-core/domain/partner-team.ts"
import { artworkToCenteredPixelArt } from "../../shared/pixel-artwork.ts"

export const buildTeamPanelModel = (
  team: PartnerTeam,
  settings: ResolvedDigitalPetSettings,
  writable: boolean,
  blocked: boolean,
  originEggIds: { principal?: string | undefined; reserve?: string | undefined } = {},
) => {
  const member = (partner: Partner | null, originEggId?: string) => {
    if (!partner) return null
    const node = DIGIMON_CATALOG.byId.get(partner.currentNodeId)
    if (!node) return null
    const artwork = MONSTER_FRAME_CATALOG.get(node.sprite, "walk_1")
    const pixel = artwork ? artworkToCenteredPixelArt(artwork.content) : null
    const portrait = artwork ? artworkToCenteredPixelArt(artwork.content, 20) : null
    const egg = node.stage === 0 ? digitamaArtworkForOrigin(originEggId) : undefined
    return {
      partnerId: partner.partnerId,
      nodeId: node.id,
      name: settings.language === "en" ? node.nameEn : node.nameJp,
      stage: getStageLabel(node.stage, settings.stageLabels[settings.language]),
      stageKey: getStageTranslationKey(node.stage, settings.stageLabels[settings.language]),
      artwork: egg?.path ?? pixel?.path ?? "",
      viewBox: egg ? "-8 -8 32 32" : (pixel?.viewBox ?? "0 0 16 16"),
      portraitViewBox: egg ? "-2 -2 20 20" : (portrait?.viewBox ?? "0 0 16 16"),
      gauge: partner.gauge,
      terminal: partner.isTerminal,
    }
  }
  return {
    revision: team.revision,
    principal: member(team.principal, originEggIds.principal),
    reserve: member(team.reserve, originEggIds.reserve),
    writable,
    canSwitch:
      writable &&
      !blocked &&
      Boolean(team.principal && team.reserve) &&
      !team.principal?.pendingEvolutionTargetId &&
      !team.principal?.battleOpponentNodeId &&
      !team.reserve?.pendingEvolutionTargetId &&
      !team.reserve?.battleOpponentNodeId,
    canCreate:
      writable && !blocked && !team.principal?.pendingEvolutionTargetId && !team.principal?.battleOpponentNodeId,
  }
}

export type TeamPanelModel = ReturnType<typeof buildTeamPanelModel>
