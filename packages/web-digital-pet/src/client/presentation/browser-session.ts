import { withDigitamaOriginArtwork } from "@jcendal/digital-pet-animation/render/digitama-artwork.ts"
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { hygieneMood } from "@jcendal/digital-pet-core/domain/hygiene.ts"
import { buildDexPanelModel } from "@jcendal/digital-pet-webviews/panels/dex/dex-model.ts"
import { buildHistoryPanelModel } from "@jcendal/digital-pet-webviews/panels/history/history-model.ts"
import { buildTeamPanelModel } from "@jcendal/digital-pet-webviews/panels/team/team-model.ts"
import { buildWorldPanelModel } from "@jcendal/digital-pet-webviews/panels/world/world-model.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { archiveFor, settingsFor } from "../../domain/pet/models.ts"
import { localTeam } from "../../domain/pet/team.ts"
import { IntlModule } from "../../shared/i18n.ts"
import { isPresentingEvolution } from "../features/partner/presentation.ts"
import {
  cleanPoop as persistCleanPoop,
  petEgg as persistPetEgg,
  readLocalState,
  readPendingBattle,
} from "../persistence/pet-store.ts"

export { presentPendingEvolution } from "../features/partner/evolution.ts"
export { updateFoodButton } from "../features/partner/food.ts"
export { cancelEvolutionPresentation, isPresentingEvolution } from "../features/partner/presentation.ts"

import { sceneMotionFor } from "../../shared/scene-motion.ts"
import { adventureEncounterPending, adventureTraveling, isPresentingAdventure } from "../features/partner/adventure.ts"
import { animation } from "../features/partner/animation.ts"

let currentPartner = ""
export const isKnownNode = (id: string): boolean => DIGIMON_CATALOG.byId.has(id)

export const sidebar = async (requestedWidth: number) => {
  const state = await readLocalState()
  const battle = await readPendingBattle()
  const snapshot: SidebarSnapshot = {
    currentNodeId: state.currentNodeId,
    combatVictories: state.combatVictories ?? 0,
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
  const adventuring = adventureTraveling() || adventureEncounterPending()
  return {
    pending: Boolean(state.pendingEvolution) && !battle,
    food: {
      partnerId: state.partnerId,
      available: state.food?.kind === "available" && !adventuring,
      canEat: !state.pendingEvolution && !battle && !adventuring,
      givesExperience: !state.isTerminal,
    },
    model: {
      ...presentation.payload,
      team: buildTeamPanelModel(
        localTeam(state),
        settingsFor(state),
        true,
        Boolean(battle) || adventuring || isPresentingEvolution(),
        { principal: state.originEggId, reserve: state.reserve?.originEggId },
      ),
      ...(DIGIMON_CATALOG.byId.get(state.currentNodeId)?.stage === 0
        ? { egg: { partnerId: state.partnerId, canPet: !state.pendingEvolution && !battle && !adventureTraveling() } }
        : {}),
      hygiene: {
        partnerId: state.partnerId,
        poops: state.hygiene?.poops ?? [],
        mood,
        canClean: !state.pendingEvolution && !battle && !adventuring,
      },
      canPet:
        presentation.payload.kind === "partner" &&
        presentation.payload.canPet &&
        !state.pendingEvolution &&
        !battle &&
        !adventureTraveling(),
    },
    frame: {
      type: "animation-frame",
      artwork: renderPositionedArtwork(withDigitamaOriginArtwork(frame, state.originEggId), width),
      motion: { ...sceneMotionFor(frame, partnerKey, width), adventuring: adventureTraveling() },
    },
  }
}

export const cleanPoop = async (partnerId: string, poopId: number, active: () => boolean): Promise<boolean> => {
  if (!active() || isPresentingAdventure() || adventureTraveling() || isPresentingEvolution()) return false
  const clean = async () =>
    !(await readPendingBattle()) && active() && (await persistCleanPoop(partnerId, poopId, active))
  if (navigator.locks)
    return navigator.locks.request("digital-pet:evolution", { ifAvailable: true }, async (lock) =>
      Boolean(lock && (await clean())),
    )
  return clean()
}

export const petEgg = (partnerId: string, interactionId: string, active: () => boolean): Promise<boolean> =>
  isPresentingEvolution() ? Promise.resolve(false) : persistPetEgg(partnerId, interactionId, active)

export const petPartner = async (width: number, active: () => boolean) => {
  if (
    !active() ||
    isPresentingAdventure() ||
    adventureTraveling() ||
    isPresentingEvolution() ||
    (await readPendingBattle())
  )
    return undefined
  const state = await readLocalState()
  if (!active() || state.pendingEvolution) return undefined
  const presentation = buildSidebarPresentation(
    {
      currentNodeId: state.currentNodeId,
      gauge: state.gauge,
      isTerminal: state.isTerminal,
      frozen: false,
      isSetOverride: false,
      trainerTotalTokens: 0,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    },
    settingsFor(state),
  )
  animation.dispatch({ kind: "partner_changed", partner: presentation.partner })
  const frame = animation.dispatch({ kind: "pet" })
  if (!frame.reaction) return undefined
  return {
    reaction: frame.reaction,
    frame: {
      type: "animation-frame",
      artwork: renderPositionedArtwork(frame, width),
      motion: sceneMotionFor(frame, currentPartner, width),
    },
  }
}

export const dex = async () => {
  const state = await readLocalState()
  const model = buildDexPanelModel(archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
  return {
    ...model,
    currentNodeId: state.currentNodeId,
    message: IntlModule.translate("browserSession.discoveriesAreSavedInThisBrowser"),
    messageKey: "web:browserSession.discoveriesAreSavedInThisBrowser",
  }
}

export const history = async () => {
  const state = await readLocalState()
  return buildHistoryPanelModel(archiveFor(state), DIGIMON_CATALOG, settingsFor(state))
}

export const world = async (regionId: string) => {
  const state = await readLocalState()
  return buildWorldPanelModel(regionId, archiveFor(state), DIGIMON_CATALOG, settingsFor(state), state.bossVictories)
}
