import type { MonsterFrameCatalog, MonsterFrameName } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { artworkPixels } from "../render/artwork-pixels.ts"

export type ExchangePhase = "packing" | "crossing" | "arrival" | "complete"
export type ExchangePixel = { x: number; y: number; size: number; color?: string }
type Point = { x: number; y: number; color?: string }
type Poses = Record<"walk_1" | "walk_2" | "happy", readonly Point[]>
export type ExchangeArtwork = { outgoing: Poses; incoming: Poses }
export const EXCHANGE_DURATION_MS = 4800
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const ease = (n: number) => {
  const t = clamp(n)
  return t * t * (3 - 2 * t)
}
const mix = (from: number, to: number, t: number) => from + (to - from) * t

export const exchangeFrame = (elapsed: number, reducedMotion = false): { phase: ExchangePhase; progress: number } => {
  const progress = clamp(elapsed / (reducedMotion ? 600 : EXCHANGE_DURATION_MS))
  const time = progress * EXCHANGE_DURATION_MS
  return {
    phase: progress === 1 ? "complete" : time < 1500 ? "packing" : time < 2600 ? "crossing" : "arrival",
    progress,
  }
}

/** Decode once per exchange; keep all poses on the same native sprite grid. */
export const prepareExchangeArtwork = (
  catalog: MonsterFrameCatalog,
  outgoing: string,
  incoming: string,
): ExchangeArtwork => {
  const poses = (sprite: string): Poses => {
    const pixels = (pose: MonsterFrameName) =>
      artworkPixels((catalog.get(sprite, pose) ?? catalog.get(sprite, "walk_1"))?.content ?? "").map(({ x, y }) => ({
        x: x - 8,
        y: y - 8,
      }))
    return { walk_1: pixels("walk_1"), walk_2: pixels("walk_2"), happy: pixels("happy") }
  }
  return { outgoing: poses(outgoing), incoming: poses(incoming) }
}
const cluster = (index: number): Point => {
  const column = (index % 5) - 2
  const row = (Math.floor(index / 5) % 5) - 2
  return { x: column + row, y: column - row }
}
const at = (pixels: readonly Point[], x: number, y: number, mirror = false): ExchangePixel[] =>
  pixels.map((p) => ({ ...p, x: x + (mirror ? -p.x - 1 : p.x) * 2, y: y + p.y * 2, size: 2 }))
const gather = (pixels: readonly Point[], x: number, y: number, progress: number, mirror: boolean): ExchangePixel[] =>
  pixels.map((p, i) => {
    const target = cluster(i)
    const t = ease((progress - (i % 7) * 0.025) / 0.85)
    return {
      ...p,
      x: x + mix((mirror ? -p.x - 1 : p.x) * 2, target.x, t),
      y: y + mix(p.y * 2, target.y, t),
      size: mix(2, 1, t),
    }
  })
const travel = (pixels: readonly Point[], progress: number, incoming: boolean): ExchangePixel[] => {
  const t = ease(progress)
  const x = incoming ? mix(60, 20, t) : mix(20, 60, t)
  const y = 29 + Math.sin(t * Math.PI) * (incoming ? 12 : -12)
  return pixels.map((p, i) => ({ ...p, x: x + cluster(i).x, y: y + cluster(i).y, size: 1 }))
}

/** A single clock drives every pixel, including the uninterrupted arrival path. Coordinates use an 80 × 56 LCD. */
export const renderExchangeScene = (art: ExchangeArtwork, elapsed: number, reducedMotion = false) => {
  const frame = exchangeFrame(elapsed, reducedMotion)
  const time = frame.progress * EXCHANGE_DURATION_MS
  let outgoing: ExchangePixel[] = []
  let incoming: ExchangePixel[] = []
  let trail: ExchangePixel[] = []
  let sparks: ExchangePixel[] = []
  if (reducedMotion) {
    if (frame.phase === "packing") {
      outgoing = at(art.outgoing.walk_1, 20, 29, true)
      incoming = at(art.incoming.walk_1, 60, 29)
    } else incoming = at(art.incoming.happy, 40, 29)
  } else if (time < 700) {
    const pose = time < 350 ? "walk_2" : "walk_1"
    outgoing = at(art.outgoing[pose], 20, 29, true)
    incoming = at(art.incoming[pose], 60, 29)
  } else if (time < 1500) {
    outgoing = gather(art.outgoing.walk_1, 20, 29, (time - 700) / 800, true)
    incoming = gather(art.incoming.walk_1, 60, 29, (time - 700) / 800, false)
  } else if (time < 2600) {
    const t = (time - 1500) / 1100
    outgoing = travel(art.outgoing.walk_1, t, false)
    incoming = travel(art.incoming.walk_1, t, true)
    trail = [
      ...travel(art.outgoing.walk_1, Math.max(0, t - 0.1), false),
      ...travel(art.incoming.walk_1, Math.max(0, t - 0.1), true),
    ].filter((_, i) => i % 5 === 0)
  } else if (time < 3700) {
    const t = ease((time - 2600) / 1100)
    incoming = gather(art.incoming.walk_1, mix(20, 40, t), 29, 1 - t, false)
    if (t < 0.75)
      outgoing = art.outgoing.walk_1.map((p, i) => ({
        ...p,
        x: mix(60, 88, t / 0.75) + cluster(i).x,
        y: 29 + cluster(i).y,
        size: 1,
      }))
  } else {
    const t = clamp((time - 3700) / 1100)
    const bounce = t < 0.65 ? Math.sin((t / 0.65) * Math.PI) * 3 : 0
    incoming = at(art.incoming.happy, 40, 29 - bounce)
    if (t < 0.85) {
      const distance = 18 + ease(t / 0.85) * 8
      sparks = (
        [
          [-1, -0.7],
          [1, -0.7],
          [-1, 0.45],
          [1, 0.45],
        ] as const
      ).flatMap(([x, y]) => [
        { x: 40 + x * distance, y: 29 + y * distance, size: 1 },
        { x: 39 + x * distance, y: 29 + y * distance, size: 1 },
        { x: 41 + x * distance, y: 29 + y * distance, size: 1 },
        { x: 40 + x * distance, y: 28 + y * distance, size: 1 },
        { x: 40 + x * distance, y: 30 + y * distance, size: 1 },
      ])
    }
  }
  return {
    ...frame,
    outgoing,
    incoming,
    trail,
    sparks,
    revealed: reducedMotion ? frame.phase !== "packing" : time >= 3700,
  }
}
