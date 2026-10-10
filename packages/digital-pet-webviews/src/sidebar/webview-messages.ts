import type { BattleFrameHud } from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import type { PresentationState } from "@jcendal/digital-pet-animation/sessions/presentation-state.ts"
import type { HygieneView } from "@jcendal/digital-pet-core/domain/hygiene.ts"
export type EggPettingView = { readonly partnerId: string; readonly canPet: boolean }
export type SidebarWebviewPayload =
  | {
      readonly type: "sidebar-model"
      readonly kind: "no_partner"
      readonly messageLine: string
      readonly messageKey?: string
    }
  | {
      readonly type: "sidebar-model"
      readonly kind: "partner"
      readonly progress: number
      readonly terminal: boolean
      readonly name: string
      readonly overrideName?: string
      readonly opponentName?: string
      readonly stage: string
      readonly stageKey?: string
      readonly nextCheck: string
      readonly gauge: string
      readonly url: string
      readonly urlLabel: string
      readonly frozen: boolean
      readonly hygiene?: HygieneView
      readonly egg?: EggPettingView
    }

export type AnimationFramePayload = {
  readonly hud?: BattleFrameHud
  readonly type: "animation-frame"
  readonly artwork: string
}

export type ExtensionToWebviewMessage =
  | SidebarWebviewPayload
  | AnimationFramePayload
  | { readonly type: "presentation-state"; readonly state: PresentationState }
  | { readonly type: "egg-petted"; readonly interactionId: string; readonly accepted: boolean }

export type WebviewToExtensionMessage =
  | { readonly type: "pet-egg"; readonly partnerId: string; readonly interactionId: string }
  | { readonly type: "clean-poop"; readonly partnerId: string; readonly poopId: number }
  | { readonly type: "sidebar-ready" }
  | { readonly type: "open-panel"; readonly panel: "dex" | "history" }
  | { readonly type: "open-url"; readonly url: string }
  | { readonly type: "artwork-width"; readonly width: number }

export const parseWebviewInboundMessage = (raw: unknown): WebviewToExtensionMessage | null => {
  if (raw === null || typeof raw !== "object") return null
  const message = raw as {
    readonly type?: unknown
    readonly panel?: unknown
    readonly url?: unknown
    readonly width?: unknown
    readonly partnerId?: unknown
    readonly poopId?: unknown
    readonly interactionId?: unknown
  }
  if (message.type === "sidebar-ready") return { type: "sidebar-ready" }
  if (
    message.type === "pet-egg" &&
    typeof message.partnerId === "string" &&
    message.partnerId.length > 0 &&
    message.partnerId.length <= 100 &&
    typeof message.interactionId === "string" &&
    message.interactionId.length > 0 &&
    message.interactionId.length <= 100
  )
    return { type: "pet-egg", partnerId: message.partnerId, interactionId: message.interactionId }
  if (
    message.type === "clean-poop" &&
    typeof message.partnerId === "string" &&
    message.partnerId.length > 0 &&
    message.partnerId.length <= 100 &&
    typeof message.poopId === "number" &&
    Number.isSafeInteger(message.poopId) &&
    message.poopId >= 0
  )
    return { type: "clean-poop", partnerId: message.partnerId, poopId: message.poopId }
  if (message.type === "open-panel" && (message.panel === "dex" || message.panel === "history"))
    return { type: "open-panel", panel: message.panel }
  if (message.type === "open-url" && typeof message.url === "string" && message.url.length > 0) {
    return { type: "open-url", url: message.url }
  }
  if (message.type === "artwork-width" && typeof message.width === "number" && Number.isFinite(message.width)) {
    return { type: "artwork-width", width: message.width }
  }
  return null
}
