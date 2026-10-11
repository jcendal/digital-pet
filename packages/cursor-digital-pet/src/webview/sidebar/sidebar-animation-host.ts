import type { PetReaction } from "@jcendal/digital-pet-animation/idle/monster-action-policy.ts"
import {
  MonsterAnimationController,
  type MonsterAnimationIdentity,
  type MonsterAnimationOutput,
} from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import type { MonsterFrameCatalog } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { PetMood } from "@jcendal/digital-pet-core/domain/hygiene.ts"

import type { AnimationSink } from "../../adapters/vscode/animation-sink.ts"
import type { IntervalScheduler } from "../../adapters/vscode/scheduler.ts"
import { SIDEBAR_VISUAL_INTERVAL_MS } from "../../shared/constants/presentation-timing.ts"
import { DEFAULT_ARTWORK_WIDTH, MIN_ARTWORK_WIDTH } from "../../shared/constants/sidebar-ui.ts"

export type SidebarAnimationHost = {
  setAdventure(active: boolean): void
  setArtworkWidth(width: number): void
  syncPartner(partner: MonsterAnimationIdentity | undefined): void
  start(): void
  stop(): void
  clearArtwork(): void
  postCurrentFrame(animation?: MonsterAnimationOutput): Promise<void>
  playFeedAnimation(): void
  petPartner(): PetReaction | undefined
  setMood(mood: PetMood): void
  isPresentationBlocked(): boolean
  setPresentationBlocked(blocked: boolean): void
  getArtworkWidth(): number
}

export type CreateSidebarAnimationHostOptions = {
  readonly frameCatalog: MonsterFrameCatalog
  readonly sink: AnimationSink
  readonly scheduler: IntervalScheduler
  readonly random?: () => number
  readonly nowMs?: () => number
  readonly isVisible?: () => boolean
}

export const createSidebarAnimationHost = ({
  frameCatalog,
  sink,
  scheduler,
  random = Math.random,
  nowMs = () => performance.now(),
  isVisible = () => true,
}: CreateSidebarAnimationHostOptions): SidebarAnimationHost => {
  const animation = new MonsterAnimationController(frameCatalog, random, nowMs)
  let adventuring = false
  let artworkWidth = DEFAULT_ARTWORK_WIDTH
  let cachedArtwork = ""
  let presentationBlocked = false
  let stopInterval: (() => void) | undefined

  const postCurrentFrame = async (nextAnimation?: MonsterAnimationOutput): Promise<void> => {
    if (presentationBlocked) return
    const output = nextAnimation ?? animation.output()
    const artwork = renderPositionedArtwork(output, artworkWidth)
    if (artwork === cachedArtwork) return
    cachedArtwork = artwork
    await sink.postArtwork(artwork)
  }

  const start = (): void => {
    if (stopInterval !== undefined) return
    stopInterval = scheduler.start(
      () => {
        if (!isVisible() || presentationBlocked) return
        void postCurrentFrame(animation.dispatch({ kind: "tick" }))
      },
      adventuring ? 250 : SIDEBAR_VISUAL_INTERVAL_MS,
    )
  }
  return {
    setAdventure(active) {
      if (adventuring === active) return
      adventuring = active
      animation.dispatch({ kind: "adventure_changed", active })
      if (stopInterval) {
        stopInterval()
        stopInterval = undefined
        start()
      }
    },
    setArtworkWidth(width: number): void {
      artworkWidth = Math.max(MIN_ARTWORK_WIDTH, Math.floor(width))
      animation.dispatch({ kind: "viewport_resized", width: artworkWidth })
    },
    syncPartner(partner: MonsterAnimationIdentity | undefined): void {
      animation.dispatch({ kind: "partner_changed", partner })
    },
    start,
    stop(): void {
      stopInterval?.()
      stopInterval = undefined
    },
    clearArtwork(): void {
      cachedArtwork = ""
    },
    postCurrentFrame,
    petPartner(): PetReaction | undefined {
      if (presentationBlocked || !isVisible()) return undefined
      const frame = animation.dispatch({ kind: "pet" })
      if (frame.reaction) void postCurrentFrame(frame)
      return frame.reaction
    },
    playFeedAnimation(): void {
      if (presentationBlocked) return
      const nextAnimation = animation.dispatch({ kind: "feed" })
      void postCurrentFrame(nextAnimation)
    },
    setMood(mood): void {
      animation.dispatch({ kind: "mood_changed", mood })
    },
    isPresentationBlocked(): boolean {
      return presentationBlocked
    },
    setPresentationBlocked(blocked: boolean): void {
      presentationBlocked = blocked
    },
    getArtworkWidth(): number {
      return artworkWidth
    },
  }
}
