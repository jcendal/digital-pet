import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import { buildDexPanelModel } from "@jcendal/digital-pet-webviews/panels/dex/dex-model.ts"
import { buildHistoryPanelModel } from "@jcendal/digital-pet-webviews/panels/history/history-model.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"

import { isPresentingEvolution } from "./browser-presentation.ts"
import { readLocalState } from "./browser-store.ts"
import { archiveFor, settingsFor } from "./local-models.ts"
export { presentPendingEvolution } from "./browser-evolution.ts"
export { isPresentingEvolution, cancelEvolutionPresentation } from "./browser-presentation.ts"
export { updateFoodButton } from "./browser-food.ts"
import { sceneMotionFor } from "./scene-motion.ts"
import { animation } from "./browser-animation.ts"

let currentPartner = ""
export const isKnownNode = (id: string): boolean => DIGIMON_CATALOG.byId.has(id)

export const sidebar = async (requestedWidth: number) => {
  const state = await readLocalState()
  const snapshot: SidebarSnapshot = {
    currentNodeId: state.currentNodeId,
    gauge: state.gauge,
    isTerminal: state.isTerminal,
    frozen: false,
    isSetOverride: false,
    trainerTotalTokens: 0,
    pendingEvolutionTargetId: state.pendingEvolution?.targetNodeId ?? null,
    battleOpponentNodeId: state.pendingEvolution?.opponentNodeId ?? null,
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
  const frame = isPresentingEvolution() ? animation.output() : animation.dispatch({ kind: "tick" })
  return {
    pending: Boolean(state.pendingEvolution),
    food: {
      partnerId: state.partnerId,
      available: state.food?.kind === "available",
      canEat: !state.pendingEvolution,
      givesExperience: !state.isTerminal,
    },
    model: presentation.payload,
    frame: {
      type: "animation-frame",
      artwork: renderPositionedArtwork(frame, width),
      motion: sceneMotionFor(frame, partnerKey, width),
    },
  }
}

export const dex = async () => {
  const state = await readLocalState()
  const model = buildDexPanelModel(archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
  return { ...model, currentNodeId: state.currentNodeId, message: "Discoveries are saved in this browser." }
}

export const history = async () => {
  const state = await readLocalState()
  return buildHistoryPanelModel(archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
}

export const world = async (regionId: string) => {
  const state = await readLocalState()
  return buildWorldPanelModel(regionId, archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
}
