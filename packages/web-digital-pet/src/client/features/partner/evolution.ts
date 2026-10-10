import { presentEvolution } from "@jcendal/digital-pet-animation/sessions/evolution-presentation.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { settingsFor } from "../../../domain/pet/models.ts"
import { pendingEvolutionKey } from "../../../domain/pet/progress.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import { finishLocalEvolution, peekLocalState, readLocalState, readPendingBattle } from "../../persistence/pet-store.ts"
import { PresentationCancelled, runForegroundEvolution } from "./foreground-evolution.ts"
import { beginPresentation, endPresentation, presentationCurrent, presentationVersion } from "./presentation.ts"

export const presentPendingEvolution = async (
  width: number,
  deliver: (message: unknown) => void,
  active: () => boolean,
  valid: () => boolean,
  updated: () => void,
): Promise<void> => {
  if (!active() || !valid() || !beginPresentation()) return
  const revision = presentationVersion()
  const play = async () => {
    if (await readPendingBattle()) return
    const state = await readLocalState()
    const pending = state.pendingEvolution
    const key = pendingEvolutionKey(state)
    if (!pending || !key) return
    const player = DIGIMON_CATALOG.byId.get(state.currentNodeId)
    const opponent = pending.opponentNodeId ? DIGIMON_CATALOG.byId.get(pending.opponentNodeId) : null
    if (!player || (pending.opponentNodeId && !opponent))
      throw new Error(IntlModule.translate("evolution.invalidPendingBattle"))
    let won = true
    await runForegroundEvolution({
      active,
      valid: () => presentationCurrent(revision) && valid(),
      current: async () => {
        const current = await peekLocalState()
        return Boolean(current && pendingEvolutionKey(current) === key)
      },
      wait: () => new Promise((resolve) => window.setTimeout(resolve, 100)),
      present: async (checkpoint) => {
        const onState = async (
          phaseState: import("@jcendal/digital-pet-animation/sessions/presentation-state.ts").PresentationState,
        ) => {
          await checkpoint()
          const node = phaseState.phase === "evolved" ? DIGIMON_CATALOG.byId.get(phaseState.toNodeId) : player
          if (node) {
            const presentation = buildSidebarPresentation(
              {
                currentNodeId: node.id,
                gauge: node.id === player.id ? state.gauge : 0,
                isTerminal: node.nextEvolutions.length === 0,
                frozen: false,
                isSetOverride: false,
                trainerTotalTokens: 0,
                pendingEvolutionTargetId: pending.targetNodeId,
                battleOpponentNodeId: pending.opponentNodeId,
              },
              settingsFor(state),
            )
            deliver({ ...presentation.payload, ...(opponent ? { opponentName: opponent.nameEn } : {}) })
          }
          deliver({ type: "presentation-state", state: phaseState })
        }
        const onArtwork: import("@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts").BattleFrameListener =
          async (artwork, hud) => {
            await checkpoint()
            deliver({ type: "animation-frame", artwork, ...(hud ? { hud } : {}) })
          }
        won =
          (await presentEvolution(player.id, pending.targetNodeId, pending.opponentNodeId, width, {
            frameCatalog: MONSTER_FRAME_CATALOG,
            digimonCatalog: DIGIMON_CATALOG,
            onState,
            onArtwork,
          })) === "player"
      },
      complete: async () => {
        await finishLocalEvolution(key, won, () => active() && valid() && presentationCurrent(revision))
        updated()
      },
    })
  }
  try {
    if (navigator.locks)
      await navigator.locks.request("digital-pet:evolution", { ifAvailable: true }, async (lock) => {
        if (lock) await play()
      })
    else await play()
  } catch (error) {
    if (!(error instanceof PresentationCancelled)) throw error
  } finally {
    endPresentation()
    deliver({ type: "presentation-state", state: { phase: "idle" } })
  }
}
