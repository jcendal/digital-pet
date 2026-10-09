import type { MonsterAnimationOutput } from "@jcendal/digital-pet-animation/idle/monster-animation.ts"

export const LANDSCAPE_MOTION_KEY = "digital-pet:landscape-motion"
export const landscapeMotionEnabled = (preference: string | null, reducedMotion: boolean): boolean =>
  preference === "on" || (preference !== "off" && !reducedMotion)

export type SceneMotion = {
  readonly walking: boolean
  readonly offset: number
  readonly facing: "left" | "right"
  readonly partnerKey: string
  readonly columns: number
}

export const sceneMotionFor = (frame: MonsterAnimationOutput, partnerKey: string, columns: number): SceneMotion => ({
  walking: frame.kind === "walking",
  offset: frame.offset,
  facing: frame.facing,
  partnerKey,
  columns,
})

export const landscapeDirection = (previous: SceneMotion | undefined, next: SceneMotion): -1 | 0 | 1 => {
  if (
    !previous?.walking ||
    !next.walking ||
    previous.partnerKey !== next.partnerKey ||
    previous.columns !== next.columns
  )
    return 0
  const delta = next.offset - previous.offset
  if (delta < 0 && next.facing === "left") return -1
  if (delta > 0 && next.facing === "right") return 1
  return 0
}

/** The reflected landscape repeats every two tiles. Four tiles cover either direction. */
export const advanceLandscape = (offset: number, direction: -1 | 0 | 1, elapsedMs: number, width: number): number => {
  if (width <= 0) return offset
  const period = width * 2
  const moved = offset + (direction * 3 * Math.min(100, Math.max(0, elapsedMs))) / 1000
  return ((((moved + width) % period) + period) % period) - width
}
