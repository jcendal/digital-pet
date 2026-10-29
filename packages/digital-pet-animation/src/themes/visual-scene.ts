import { isVisualThemeId, type VisualThemeId } from "@jcendal/digital-pet-core/config/theme.ts"
import { createPixelFrame, type PixelFrame } from "./pixel-frame.ts"

export const VISUAL_SCENE_VERSION = 1
export const MAX_SCENE_DIMENSION = 512
export const MAX_SCENE_LAYERS = 32
const MAX_SCENE_SOURCE_PIXELS = 262_144

export type VisualLayer = Readonly<{
  frame: PixelFrame
  x: number
  y: number
  scale: number
  facing: "left" | "right"
  opacity: number
}>

/** Pixel geometry only. Localized HUD and gameplay state remain separate. */
export type VisualScene = Readonly<{
  version: typeof VISUAL_SCENE_VERSION
  theme: VisualThemeId
  width: number
  height: number
  layers: readonly VisualLayer[]
}>

const validDimension = (value: number) => Number.isSafeInteger(value) && value > 0 && value <= MAX_SCENE_DIMENSION
const validPosition = (value: number) => Number.isSafeInteger(value) && Math.abs(value) <= MAX_SCENE_DIMENSION * 2

export const createVisualScene = (
  theme: VisualThemeId,
  width: number,
  height: number,
  layers: readonly VisualLayer[],
): VisualScene => {
  if (!isVisualThemeId(theme) || !validDimension(width) || !validDimension(height))
    throw new Error("Invalid visual scene header")
  if (
    layers.length > MAX_SCENE_LAYERS ||
    layers.reduce((sum, layer) => sum + layer.frame.width * layer.frame.height, 0) > MAX_SCENE_SOURCE_PIXELS
  )
    throw new Error("Visual scene exceeds its resource budget")
  const copy = layers.map((layer) => {
    if (
      !validPosition(layer.x) ||
      !validPosition(layer.y) ||
      !Number.isSafeInteger(layer.scale) ||
      layer.scale < 1 ||
      layer.scale > 8 ||
      (layer.facing !== "left" && layer.facing !== "right") ||
      !Number.isFinite(layer.opacity) ||
      layer.opacity < 0 ||
      layer.opacity > 1
    )
      throw new Error("Invalid visual layer")
    return Object.freeze({
      frame: createPixelFrame(layer.frame.width, layer.frame.height, layer.frame.palette, layer.frame.pixels),
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
      facing: layer.facing,
      opacity: layer.opacity,
    })
  })
  return Object.freeze({ version: VISUAL_SCENE_VERSION, theme, width, height, layers: Object.freeze(copy) })
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object")
  return value as Record<string, unknown>
}
const number = (value: unknown): number => {
  if (typeof value !== "number") throw new Error("Expected a number")
  return value
}

/** Validate postMessage/JSON inputs and discard unrecognized fields. Never trust a cast. */
export const parseVisualScene = (value: unknown): VisualScene | null => {
  try {
    const { version, theme, width, height, layers: rawLayers } = record(value)
    if (version !== VISUAL_SCENE_VERSION || !isVisualThemeId(theme)) return null
    if (!Array.isArray(rawLayers) || rawLayers.length > MAX_SCENE_LAYERS) return null
    let sourcePixels = 0
    const layers = Array.from(rawLayers, (raw: unknown): VisualLayer => {
      const { frame, x, y, scale, opacity, facing } = record(raw)
      const { width: frameWidth, height: frameHeight, pixels, palette } = record(frame)
      if (!Array.isArray(pixels) || !Array.isArray(palette) || palette.length > 256) throw new Error("Invalid frame")
      sourcePixels += pixels.length
      if (sourcePixels > MAX_SCENE_SOURCE_PIXELS) throw new Error("Frame budget exceeded")
      if (!pixels.every((v: unknown) => typeof v === "number")) throw new Error("Invalid indices")
      if (!palette.every((v: unknown) => v === null || typeof v === "string")) throw new Error("Invalid palette")
      if (facing !== "left" && facing !== "right") throw new Error("Invalid facing")
      return {
        frame: createPixelFrame(number(frameWidth), number(frameHeight), palette, pixels),
        x: number(x),
        y: number(y),
        scale: number(scale),
        opacity: number(opacity),
        facing,
      }
    })
    return createVisualScene(theme, number(width), number(height), layers)
  } catch {
    return null
  }
}

/** Iterate only visible pixels, bounding work even when a large layer is offscreen. */
export const visitLayerPixels = (
  scene: VisualScene,
  layer: VisualLayer,
  visit: (x: number, y: number, color: string) => void,
): void => {
  if (layer.opacity === 0) return
  const right = Math.min(scene.width, layer.x + layer.frame.width * layer.scale)
  const bottom = Math.min(scene.height, layer.y + layer.frame.height * layer.scale)
  for (let y = Math.max(0, layer.y); y < bottom; y += 1) {
    for (let x = Math.max(0, layer.x); x < right; x += 1) {
      const column = Math.floor((x - layer.x) / layer.scale)
      const sourceX = layer.facing === "right" ? layer.frame.width - 1 - column : column
      const sourceY = Math.floor((y - layer.y) / layer.scale)
      const index = layer.frame.pixels[sourceY * layer.frame.width + sourceX] ?? 0
      const color = layer.frame.palette[index]
      if (color) visit(x, y, color)
    }
  }
}
