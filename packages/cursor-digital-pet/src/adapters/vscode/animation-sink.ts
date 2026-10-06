import type { BattleFrameHud } from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import type { PresentationState } from "@jcendal/digital-pet-animation/sessions/presentation-state.ts"
import type { SidebarWebviewPayload } from "../../webview/sidebar/webview-messages.ts"
import type { WebviewMessenger } from "./webview-messenger.ts"

export type AnimationSink = {
  postState?(state: PresentationState): Promise<void>
  postArtwork(artwork: string, hud?: BattleFrameHud): Promise<void>
  postModel(payload: SidebarWebviewPayload): Promise<void>
}

export const createAnimationSink = (messenger: WebviewMessenger): AnimationSink => ({
  async postState(state: PresentationState): Promise<void> {
    await messenger.post({ type: "presentation-state", state })
  },
  async postArtwork(artwork: string, hud?: BattleFrameHud): Promise<void> {
    await messenger.post({ type: "animation-frame", artwork, ...(hud === undefined ? {} : { hud }) })
  },
  async postModel(payload: SidebarWebviewPayload): Promise<void> {
    await messenger.post(payload)
  },
})
