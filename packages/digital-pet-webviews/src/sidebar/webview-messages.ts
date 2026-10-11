import type { PetReaction } from "@jcendal/digital-pet-animation/idle/monster-action-policy.ts"
import type { BattleFrameHud } from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import type { PresentationState } from "@jcendal/digital-pet-animation/sessions/presentation-state.ts"
import type { AdventureCommand, AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { HygieneView } from "@jcendal/digital-pet-core/domain/hygiene.ts"
export type AdventureView = {
  readonly available: boolean
  readonly readyAt: number
  readonly lootLifetimeMs: number
  readonly state?: Omit<AdventureState, "event"> & {
    readonly event?:
      | { readonly kind: "loot"; readonly id: number; readonly item: "food" | "fragment"; readonly appearedAt: number }
      | { readonly kind: "battle"; readonly id: number; readonly difficult: boolean; readonly opponentName: string }
      | { readonly kind: "offer"; readonly id: number; readonly opponentName: string }
  }
}
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
      readonly canPet?: boolean
      readonly hygiene?: HygieneView
      readonly egg?: EggPettingView
    }

export type AnimationFramePayload = {
  readonly hud?: BattleFrameHud
  readonly type: "animation-frame"
  readonly artwork: string
}

export type ExtensionToWebviewMessage =
  | { readonly type: "adventure-state"; readonly view: AdventureView }
  | SidebarWebviewPayload
  | AnimationFramePayload
  | { readonly type: "presentation-state"; readonly state: PresentationState }
  | { readonly type: "egg-petted"; readonly interactionId: string; readonly accepted: boolean }
  | { readonly type: "partner-petted"; readonly interactionId: string; readonly reaction?: PetReaction }

export type WebviewToExtensionMessage =
  | { readonly type: "adventure"; readonly command: AdventureCommand }
  | { readonly type: "pet-egg"; readonly partnerId: string; readonly interactionId: string }
  | { readonly type: "pet-partner"; readonly interactionId: string }
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
    readonly command?: unknown
  }
  if (message.type === "sidebar-ready") return { type: "sidebar-ready" }
  if (message.type === "adventure" && message.command && typeof message.command === "object") {
    const command = message.command as {
      readonly kind?: unknown
      readonly id?: unknown
      readonly eventId?: unknown
      readonly adventureId?: unknown
    }
    if (
      command.adventureId !== undefined &&
      (typeof command.adventureId !== "string" || !command.adventureId || command.adventureId.length > 100)
    )
      return null
    const identity = typeof command.adventureId === "string" ? { adventureId: command.adventureId } : {}
    if (command.kind === "start" && typeof command.id === "string" && command.id.length > 0 && command.id.length <= 100)
      return { type: "adventure", command: { kind: "start", id: command.id, ...identity } }
    if (command.kind === "pause" || command.kind === "resume" || command.kind === "stop" || command.kind === "tick")
      return { type: "adventure", command: { kind: command.kind, ...identity } }
    if (
      (command.kind === "collect" || command.kind === "accept-companion" || command.kind === "decline-companion") &&
      typeof command.eventId === "number" &&
      Number.isSafeInteger(command.eventId) &&
      command.eventId > 0
    )
      return { type: "adventure", command: { kind: command.kind, eventId: command.eventId, ...identity } }
  }
  if (
    message.type === "pet-partner" &&
    typeof message.interactionId === "string" &&
    message.interactionId.length > 0 &&
    message.interactionId.length <= 100
  )
    return { type: "pet-partner", interactionId: message.interactionId }
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
