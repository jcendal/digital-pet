import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import { MonsterAnimationController } from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import { buildDexPanelModel } from "@jcendal/digital-pet-webviews/panels/dex/dex-model.ts"
import { buildHistoryPanelModel } from "@jcendal/digital-pet-webviews/panels/history/history-model.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"

import { readLocalState } from "./browser-store.ts"
import { experienceMultiplier, type LocalPetState } from "./local-progress.ts"

const animation = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
let currentPartner = ""

export const isKnownNode = (id: string): boolean => DIGIMON_CATALOG.byId.has(id)

const archiveFor = (state: LocalPetState): DigitalPetArchiveResult => ({
  kind: "available",
  partners: [
    ...(state.retiredPartners ?? []).map((partner, index) => ({
      ...partner,
      generation: index + 1,
      events: partner.events.map((event, eventIndex) => ({ eventId: `${index}:${eventIndex}`, ...event })),
    })),
    {
      partnerId: state.partnerId,
      generation: (state.retiredPartners?.length ?? 0) + 1,
      createdAt: state.createdAt,
      retiredAt: null,
      events: state.events.map((event, index) => ({ eventId: String(index), ...event })),
    },
  ],
})

const settingsFor = (state: LocalPetState) => ({
  ...DEFAULT_DIGITAL_PET_SETTINGS,
  stageThresholds: Object.fromEntries(
    Object.entries(DEFAULT_DIGITAL_PET_SETTINGS.stageThresholds).map(([stage, threshold]) => [
      stage,
      threshold * experienceMultiplier(state.experienceLevel),
    ]),
  ) as typeof DEFAULT_DIGITAL_PET_SETTINGS.stageThresholds,
})

export const sidebar = async (requestedWidth: number) => {
  const state = await readLocalState()
  const snapshot: SidebarSnapshot = {
    currentNodeId: state.currentNodeId,
    gauge: state.gauge,
    isTerminal: state.isTerminal,
    frozen: false,
    isSetOverride: false,
    trainerTotalTokens: 0,
    pendingEvolutionTargetId: null,
    battleOpponentNodeId: null,
  }
  const presentation = buildSidebarPresentation(snapshot, settingsFor(state))
  const identity = presentation.partner
  const partnerKey = identity ? `${identity.sprite}:${identity.isDigitama}` : ""
  if (partnerKey !== currentPartner) {
    currentPartner = partnerKey
    animation.dispatch({ kind: "partner_changed", partner: identity })
  }
  const width = Math.max(16, Math.min(120, Math.floor(requestedWidth) || 40))
  animation.dispatch({ kind: "viewport_resized", width })
  const frame = animation.dispatch({ kind: "tick" })
  return {
    model: presentation.payload,
    frame: { type: "animation-frame", artwork: renderPositionedArtwork(frame, width) },
  }
}

export const dex = async () => {
  const state = await readLocalState()
  const model = buildDexPanelModel(archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
  return { ...model, message: "Discoveries are saved in this browser." }
}

export const history = async () => {
  const state = await readLocalState()
  return buildHistoryPanelModel(archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
}

export const world = async (regionId: string) => {
  const state = await readLocalState()
  return buildWorldPanelModel(regionId, archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
}
