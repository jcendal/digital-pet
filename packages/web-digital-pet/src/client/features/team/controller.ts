import { adventureBusy } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { TeamCommand } from "@jcendal/digital-pet-core/domain/partner-team.ts"
import { discoveredEggFamilies } from "@jcendal/digital-pet-fields/data/egg-discoveries.ts"
import { IntlModule as ViewIntl } from "@jcendal/digital-pet-webviews/i18n.ts"
import { buildEggCollectionModel } from "@jcendal/digital-pet-webviews/panels/team/egg-model.ts"
import { buildTeamPanelModel } from "@jcendal/digital-pet-webviews/panels/team/team-model.ts"
import { settingsFor } from "../../../domain/pet/models.ts"
import { localTeam } from "../../../domain/pet/team.ts"
import {
  applyBrowserTeamCommand,
  readAdventureState,
  readLocalState,
  readPendingBattle,
} from "../../persistence/pet-store.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"

let interactionBusy = () => false
export const registerTeamBusyGuard = (guard: () => boolean): void => {
  interactionBusy = guard
}
export const openNewEgg = (): void => {
  window.dispatchEvent(new CustomEvent("digital-pet:navigate", { detail: "/dex?tab=team" }))
  window.dispatchEvent(new Event("digital-pet:new-egg"))
}

export const initBrowserTeam = async (): Promise<void> => {
  let refreshing = false
  let submitting = false
  const deliver = (data: unknown) => window.postMessage(data, location.origin)
  const refresh = async () => {
    if (refreshing) return
    refreshing = true
    const browser = browserSaveSelected()
    try {
      if (browser) {
        const [state, adventure, battle] = await Promise.all([
          readLocalState(),
          readAdventureState(),
          readPendingBattle(),
        ])
        if (!browserSaveSelected()) return
        deliver({
          type: "team-model",
          model: buildTeamPanelModel(
            localTeam(state),
            settingsFor(state),
            true,
            interactionBusy() || Boolean(battle) || adventureBusy(adventure),
            { principal: state.originEggId, reserve: state.reserve?.originEggId },
          ),
        })
        deliver({ type: "eggs-model", eggs: buildEggCollectionModel(discoveredEggFamilies(state.bossVictories ?? [])) })
      } else {
        const response = await fetch("/api/team")
        if (!response.ok) throw new Error(ViewIntl.translate("team.errorInvalid"))
        const data = await response.json()
        if (browserSaveSelected()) return
        deliver({ type: "team-model", model: data.model })
        deliver({ type: "eggs-model", eggs: data.eggs })
        const status = document.getElementById("team-status")
        if (status) status.textContent = ViewIntl.translate("team.computerHint")
      }
    } finally {
      refreshing = false
    }
  }
  const act = async (action: unknown, reply?: (data: unknown) => void) => {
    const respond = (accepted: boolean, message: string) => {
      const result = { type: "team-result", accepted, message }
      deliver(result)
      reply?.(result)
    }
    if (submitting || !browserSaveSelected() || interactionBusy())
      return respond(false, ViewIntl.translate("team.errorBusy"))
    if (!action || typeof action !== "object") return
    const input = action as Record<string, unknown>
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      (input.expectedPrincipalId !== null && typeof input.expectedPrincipalId !== "string") ||
      (input.expectedReserveId !== null && typeof input.expectedReserveId !== "string")
    )
      return respond(false, ViewIntl.translate("team.errorInvalid"))
    if (input.kind !== "switch" && input.kind !== "create-egg")
      return respond(false, ViewIntl.translate("team.errorInvalid"))
    if (
      input.kind === "create-egg" &&
      ((input.slot !== "principal" && input.slot !== "reserve") || typeof input.familyId !== "string")
    )
      return respond(false, ViewIntl.translate("team.errorInvalid"))
    const expectation = {
      expectedRevision: input.expectedRevision as number,
      expectedPrincipalId: input.expectedPrincipalId as string | null,
      expectedReserveId: input.expectedReserveId as string | null,
    }
    const command: TeamCommand =
      input.kind === "switch"
        ? { ...expectation, kind: "switch" }
        : {
            ...expectation,
            kind: "place",
            slot: input.slot as "principal" | "reserve",
            partner: { currentNodeId: "0-001", gauge: 0, isTerminal: false, createdAt: new Date().toISOString() },
          }
    submitting = true
    try {
      const result = await applyBrowserTeamCommand(
        command,
        () => browserSaveSelected() && !interactionBusy(),
        input.kind === "create-egg" ? (input.familyId as string) : undefined,
      )
      respond(
        result.kind === "applied",
        result.kind === "applied"
          ? ""
          : ViewIntl.translate(
              result.reason === "stale"
                ? "team.errorStale"
                : result.reason === "busy"
                  ? "team.errorBusy"
                  : "team.errorInvalid",
            ),
      )
      refreshBrowserViews()
      await refresh()
    } catch (error) {
      respond(false, error instanceof Error ? error.message : ViewIntl.translate("team.errorInvalid"))
    } finally {
      submitting = false
    }
  }
  window.addEventListener("digital-pet:team-action", (event) => {
    void act((event as CustomEvent).detail)
  })
  window.addEventListener("message", (event) => {
    const frame = document.querySelector<HTMLIFrameElement>('.web-view[data-page="sidebar"]')
    if (
      event.origin !== location.origin ||
      event.source !== frame?.contentWindow ||
      event.data?.type !== "digital-pet:switch-companion"
    )
      return
    void act(event.data.command, (result) =>
      frame.contentWindow?.postMessage({ type: "digital-pet:team-result", result }, location.origin),
    )
  })
  window.addEventListener("digital-pet:save-updated", () => {
    void refresh()
  })
  window.addEventListener("storage", () => {
    void refresh()
  })
  window.addEventListener("focus", () => {
    void refresh()
  })
  window.setInterval(() => {
    if (document.visibilityState === "visible") void refresh()
  }, 5000)
  await refresh()
}
