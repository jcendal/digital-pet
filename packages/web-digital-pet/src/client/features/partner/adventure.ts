import type { BattleFrameHud } from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import { runAdventureBattleSession } from "@jcendal/digital-pet-animation/sessions/adventure-battle-session.ts"
import { createAdventureService } from "@jcendal/digital-pet-core/application/use-cases/explore-adventure.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { AdventureCommand, AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"
import { getRegionBosses, getRegionResidents } from "@jcendal/digital-pet-fields/application/world.ts"
import { adventureView } from "@jcendal/digital-pet-webviews/sidebar/adventure-view.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { settingsFor } from "../../../domain/pet/models.ts"
import { browserAdventureStore, peekLocalState, readPendingBattle } from "../../persistence/pet-store.ts"
import { animation } from "./animation.ts"
import {
  beginPresentation,
  endPresentation,
  isPresentingEvolution,
  presentationCurrent,
  presentationVersion,
} from "./presentation.ts"

const service = createAdventureService(
  browserAdventureStore,
  DIGIMON_CATALOG,
  (regionId) => getRegionResidents(regionId, DIGIMON_CATALOG),
  Math.random,
  (regionId) => getRegionBosses(regionId, DIGIMON_CATALOG),
)
let state: AdventureState | undefined
let initialized = false
let playing = false
export const adventureTraveling = (): boolean => state?.status === "travel" && state.running
export const adventureEncounterPending = (): boolean =>
  state?.status === "travel" && (state.event?.kind === "battle" || state.event?.kind === "offer")
export const isPresentingAdventure = (): boolean => playing

export const refreshAdventure = async () => {
  if (!initialized) {
    await service.act({ kind: "pause" }, Date.now())
    initialized = true
  }
  state = await service.act({ kind: "read" }, Date.now())
  const pet = await peekLocalState()
  const battle = await readPendingBattle()
  const available = Boolean(
    pet && DIGIMON_CATALOG.byId.get(pet.currentNodeId)?.stage && !pet.pendingEvolution && !battle,
  )
  animation.dispatch({ kind: "adventure_changed", active: adventureTraveling() && state?.event?.kind !== "battle" })
  return {
    type: "adventure-state",
    view: adventureView(available, state, DIGIMON_CATALOG, await service.nextReadyAt()),
  }
}

export const actAdventure = async (
  command: AdventureCommand,
  width: number,
  active: () => boolean,
  deliver: (message: unknown) => void,
  changed: () => void,
): Promise<void> => {
  if ((!playing && isPresentingEvolution()) || (playing && command.kind !== "pause")) return
  const effective = !active()
    ? { kind: "pause" as const, ...(command.adventureId ? { adventureId: command.adventureId } : {}) }
    : command
  state = (await service.act(effective, Date.now())) ?? state
  deliver(await refreshAdventure())
  if (state?.running && state.event?.kind === "battle" && !playing && active()) {
    const saved = state
    const opponentNodeId = state.event.opponentNodeId
    const pet = await peekLocalState()
    if (!pet || pet.currentNodeId !== saved.nodeId) return
    const presentation = buildSidebarPresentation(
      {
        currentNodeId: pet.currentNodeId,
        gauge: pet.gauge,
        isTerminal: pet.isTerminal,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 0,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      },
      settingsFor(pet),
    )
    if (!beginPresentation()) return
    const revision = presentationVersion()
    playing = true
    try {
      const play = async () => {
        deliver({ ...presentation.payload, opponentName: DIGIMON_CATALOG.byId.get(opponentNodeId)?.nameEn ?? "" })
        return runAdventureBattleSession(saved, width, {
          frames: MONSTER_FRAME_CATALOG,
          catalog: DIGIMON_CATALOG,
          active: () => active() && presentationCurrent(revision) && state?.running === true && state.id === saved.id,
          onState: async (next) => {
            deliver({ type: "presentation-state", state: next })
          },
          onFrame: async (artwork: string, hud?: BattleFrameHud) => {
            deliver({ type: "animation-frame", artwork, hud })
          },
          checkpoint: async (eventId, completedShots) => {
            const next = await service.act(
              { kind: "checkpoint", eventId, completedShots, adventureId: saved.id },
              Date.now(),
            )
            return (
              next?.id === saved.id && next.event?.kind === "battle" && next.event.completedShots === completedShots
            )
          },
          finish: async (eventId) => {
            await service.act({ kind: "finish-battle", eventId, adventureId: saved.id }, Date.now())
          },
        })
      }
      const completed = navigator.locks
        ? await navigator.locks.request("digital-pet:evolution", { ifAvailable: true }, async (lock) =>
            lock ? play() : false,
          )
        : await play()
      if (!completed) await service.act({ kind: "pause" }, Date.now())
    } finally {
      playing = false
      endPresentation()
      if (!active()) await service.act({ kind: "pause" }, Date.now())
      deliver({ type: "presentation-state", state: { phase: "idle" } })
      deliver(await refreshAdventure())
      changed()
    }
  } else if (command.kind !== "tick") changed()
}
