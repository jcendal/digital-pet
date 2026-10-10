import type { BattleFrameHud } from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { battleNode } from "../../../domain/battle/protocol.ts"
import type { PendingBattle } from "../../../domain/battle/saved-battle.ts"
import { settingsFor } from "../../../domain/pet/models.ts"
import { IntlModule } from "../../../shared/i18n.ts"
import { readLocalState } from "../../persistence/pet-store.ts"
import { browserSaveSelected } from "../../platform/save-source.ts"

/** The shell owns playback; the pet frame owns rendering and suspends its idle refreshes. */
export const createBattleViewer = (battle: PendingBattle) => {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-page="sidebar"]')
  const send = (message: unknown): void => {
    frame?.contentWindow?.postMessage(
      { type: "digital-pet:battle-presentation", battleId: battle.battleId, message },
      location.origin,
    )
  }
  return {
    get active(): boolean {
      return Boolean(
        frame?.classList.contains("active") &&
          !document.hidden &&
          !document.querySelector("dialog[open]") &&
          browserSaveSelected(),
      )
    },
    get width(): number {
      const arena = frame?.contentDocument?.querySelector<HTMLElement>(".arena")
      const pixelSize = arena ? Number.parseFloat(getComputedStyle(arena).getPropertyValue("--artwork-pixel-size")) : 6
      return Math.max(36, Math.min(120, Math.floor((arena?.clientWidth ?? 240) / (pixelSize || 6))))
    },
    async show(): Promise<void> {
      for (const dialog of Array.from(document.querySelectorAll<HTMLDialogElement>(".web-dialog[open]"))) dialog.close()
      window.dispatchEvent(new CustomEvent("digital-pet:navigate", { detail: "/" }))
      if (!frame) throw new Error(IntlModule.translate("controller.missingBattleControl", { id: "sidebar" }))
      if (frame.contentDocument?.readyState !== "complete")
        await new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }))
      const state = await readLocalState()
      const local = battleNode((battle.localSide === "player" ? battle.challenger : battle.receiver).nodeId)
      const remote = battleNode((battle.localSide === "player" ? battle.receiver : battle.challenger).nodeId)
      const presentation = buildSidebarPresentation(
        {
          currentNodeId: local.id,
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
      send({ ...presentation.payload, opponentName: remote.nameEn })
      send({ type: "presentation-state", state: { phase: "battle", fromNodeId: local.id, opponentNodeId: remote.id } })
    },
    frame(artwork: string, hud?: BattleFrameHud): void {
      send({ type: "animation-frame", artwork, ...(hud ? { hud } : {}) })
    },
    finish(): void {
      send({ type: "presentation-state", state: { phase: "idle" } })
    },
  }
}
