import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { hygieneMood } from "@jcendal/digital-pet-core/domain/hygiene.ts"
import { buildDexPanelModel } from "@jcendal/digital-pet-webviews/panels/dex/dex-model.ts"
import { buildHistoryPanelModel } from "@jcendal/digital-pet-webviews/panels/history/history-model.ts"
import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { archiveFor, settingsFor } from "../../domain/pet/models.ts"
import { isPresentingEvolution } from "../features/partner/presentation.ts"
import { cleanPoop as persistCleanPoop, readLocalState, readPendingBattle } from "../persistence/pet-store.ts"

export { presentPendingEvolution } from "../features/partner/evolution.ts"
export { updateFoodButton } from "../features/partner/food.ts"
export { cancelEvolutionPresentation, isPresentingEvolution } from "../features/partner/presentation.ts"

import { sceneMotionFor } from "../../shared/scene-motion.ts"
import { animation } from "../features/partner/animation.ts"

let currentPartner = ""
export const isKnownNode = (id: string): boolean => DIGIMON_CATALOG.byId.has(id)

export const sidebar = async (requestedWidth: number) => {
  const state = await readLocalState()
  const battle = await readPendingBattle()
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
  const mood = hygieneMood(state.hygiene, Date.now())
  const identity = presentation.partner
  const partnerKey = identity ? `${identity.sprite}:${identity.isDigitama}` : ""
  if (partnerKey !== currentPartner) {
    currentPartner = partnerKey
    animation.dispatch({ kind: "partner_changed", partner: identity })
  }
  const width = Math.max(16, Math.min(120, Math.floor(requestedWidth) || 40))
  animation.dispatch({ kind: "viewport_resized", width })
  animation.dispatch({ kind: "mood_changed", mood })
  const frame = isPresentingEvolution() ? animation.output() : animation.dispatch({ kind: "tick" })
  return {
    pending: Boolean(state.pendingEvolution) && !battle,
    food: {
      partnerId: state.partnerId,
      available: state.food?.kind === "available",
      canEat: !state.pendingEvolution && !battle,
      givesExperience: !state.isTerminal,
    },
    model: {
      ...presentation.payload,
      hygiene: {
        partnerId: state.partnerId,
        poops: state.hygiene?.poops ?? [],
        mood,
        canClean: !state.pendingEvolution && !battle,
      },
    },
    frame: {
      type: "animation-frame",
      artwork: renderPositionedArtwork(frame, width),
      motion: sceneMotionFor(frame, partnerKey, width),
    },
  }
}

export const cleanPoop = async (partnerId: string, poopId: number, active: () => boolean): Promise<boolean> => {
  if (!active() || isPresentingEvolution()) return false
  const clean = async () =>
    !(await readPendingBattle()) && active() && (await persistCleanPoop(partnerId, poopId, active))
  if (navigator.locks)
    return navigator.locks.request("digital-pet:evolution", { ifAvailable: true }, async (lock) =>
      Boolean(lock && (await clean())),
    )
  return clean()
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
