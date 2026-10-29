import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import identities from "@jcendal/digital-pet-core/data/color-sprite-identities.json"
import type { MonsterFrameName } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import extras from "../../assets/themes/color/generated/extras.json" with { type: "json" }
import { BATTLE_GAP_COLUMNS } from "../constants/evolution-battle.ts"
import { artworkPixels } from "../render/artwork-pixels.ts"
import { FIREBALL_LINES } from "../sequences/evolution-battle-artwork.ts"
import type { ArtworkSnapshot } from "./artwork-snapshot.ts"
import { resolveMonsterVisual } from "./monster-visuals.ts"
import { createPixelFrame, type PixelFrame } from "./pixel-frame.ts"
import { createVisualScene, type VisualLayer } from "./visual-scene.ts"

const sourceFrames: Readonly<Record<string, PixelFrame>> = extras.frames
const attacks: Readonly<Record<string, number>> = extras.attacks
const origins: Readonly<Record<string, string>> = extras.eggs
const sourceIds = new Map(Object.entries(identities.nodes))
const sprites = new Map(DIGIMON_CATALOG.nodes.map((node) => [node.sprite, node.id]))
const frameCache = new Map<string, PixelFrame>()
const extraFrame = (key: string): PixelFrame | undefined => {
  const source = sourceFrames[key]
  if (!source) return undefined
  let frame = frameCache.get(key)
  if (!frame) {
    frame = createPixelFrame(source.width, source.height, source.palette, source.pixels)
    frameCache.set(key, frame)
  }
  return frame
}

export const colorMonsterFrame = (
  nodeId: string,
  pose: MonsterFrameName = "walk_1",
  origin?: string,
): PixelFrame | undefined => {
  if (nodeId === "0-001" && origin && origins[origin]) {
    const egg = extraFrame(`egg-${origins[origin]}-${pose === "walk_2" ? 1 : 0}`)
    if (egg) return egg
  }
  const result = resolveMonsterVisual("color", nodeId, pose)
  return result.kind === "frame" ? result.frame : undefined
}

/** Original effect geometry with an authored fire/impact palette; not an official species assignment. */
const effectFrame = (artwork: string, palette: readonly string[]): PixelFrame => {
  const rows = artwork.split("\n")
  const width = Math.max(...rows.map((row) => row.length))
  const height = rows.length * 2
  const pixels = Array.from({ length: width * height }, () => 0)
  for (const { x, y } of artworkPixels(artwork)) pixels[y * width + x] = 1 + ((x + y) % palette.length)
  return createPixelFrame(width, height, [null, ...palette], pixels)
}
const genericShot = effectFrame(FIREBALL_LINES.join("\n"), ["#a33716", "#f58124", "#ffda64"])
const impact = effectFrame(" ▄█▄ \n █▀█ \n ▀▀▀ ", ["#fff2a6", "#efae32", "#e55732"])

/** Node identities from the active presentation disambiguate shared legacy sprite keys. */
export const colorArtworkScene = (snapshot: ArtworkSnapshot, nodeIds: readonly string[] = []) => {
  const width = Math.max(16, Math.min(240, Math.floor(snapshot.width)))
  const layers: VisualLayer[] = []
  const identity = (sprite: string) =>
    nodeIds.find((id) => DIGIMON_CATALOG.byId.get(id)?.sprite === sprite) ?? sprites.get(sprite)
  const add = (frame: PixelFrame | undefined, x: number, y = 0, facing: "left" | "right" = "left", opacity = 1) => {
    if (frame) layers.push({ frame, x, y, facing, opacity, scale: 1 })
  }
  const monster = (sprite: string, pose: MonsterFrameName, origin?: string) => {
    const id = identity(sprite)
    return id ? colorMonsterFrame(id, pose, origin) : undefined
  }
  if (snapshot.kind === "monster") {
    const free = Math.max(width - 16, 0)
    add(
      monster(snapshot.sprite, snapshot.pose, snapshot.origin),
      Math.max(0, Math.min(free, Math.floor(free / 2) + (snapshot.offset ?? 0))),
      0,
      snapshot.facing,
    )
  } else if (snapshot.kind === "battle") {
    const { scene } = snapshot
    const battleWidth = 32 + BATTLE_GAP_COLUMNS
    const left = Math.max(0, Math.floor((width - battleWidth) / 2))
    const pose = (value: string, alternate: boolean): MonsterFrameName =>
      value === "injured"
        ? alternate
          ? "injured_2"
          : "injured_1"
        : value === "happy"
          ? "happy"
          : value === "attack"
            ? "attack"
            : "walk_1"
    add(monster(snapshot.player, pose(scene.playerPose, scene.playerInjuredAlt)), left, 0, "right")
    add(monster(snapshot.opponent, pose(scene.opponentPose, scene.opponentInjuredAlt)), left + 16 + BATTLE_GAP_COLUMNS)
    if (scene.shooter) {
      const id = identity(scene.shooter === "player" ? snapshot.player : snapshot.opponent)
      const upstream = id && sourceIds.get(id)?.sprite
      const index = upstream ? attacks[upstream] : undefined
      const shot = index === undefined ? genericShot : (extraFrame(`attack-${index}`) ?? genericShot)
      const travel = BATTLE_GAP_COLUMNS - shot.width
      const progress = Math.min(1, Math.max(0, scene.progress))
      const x = left + 16 + Math.round((scene.shooter === "player" ? progress : 1 - progress) * travel)
      // Source projectiles face right; VisualLayer's right facing mirrors a source frame.
      add(shot, x, Math.floor((16 - shot.height) / 2), scene.shooter === "player" ? "left" : "right")
      if (scene.lastResult === "hit")
        add(impact, left + 16 + (scene.shooter === "player" ? BATTLE_GAP_COLUMNS - impact.width : 0), 4)
    }
    return createVisualScene("color", Math.max(width, battleWidth), 16, layers)
  } else {
    const { phase, progress } = snapshot.scene
    const x = Math.max(0, Math.floor((width - 16) / 2))
    const from = monster(snapshot.from, "walk_1")
    const to = monster(snapshot.to, phase === "reveal" ? "happy" : "walk_1")
    if (phase === "glow") {
      add(from, x)
      if (from)
        add(
          createPixelFrame(
            16,
            16,
            [null, "#fff0a1"],
            from.pixels.map((pixel) => (pixel ? 1 : 0)),
          ),
          x,
          0,
          "left",
          (Math.sin(snapshot.tick * 0.85) + 1) * 0.3,
        )
    } else if (phase === "morph") {
      add(from, x, 0, "left", 1 - progress)
      add(to, x, 0, "left", progress)
    } else add(to, x)
  }
  return createVisualScene("color", width, 16, layers)
}

const exchangeCache = new Map<string, import("../sequences/partner-exchange.ts").ExchangeArtwork>()
export const colorExchangeArtwork = (outgoing: string, incoming: string) => {
  const key = `${outgoing}:${incoming}`
  const cached = exchangeCache.get(key)
  if (cached) return cached
  const poses = (id: string) => {
    const pixels = (pose: MonsterFrameName) => {
      const frame = colorMonsterFrame(id, pose)
      return frame
        ? frame.pixels.flatMap((index, position) => {
            const color = frame.palette[index]
            return color ? [{ x: (position % 16) - 8, y: Math.floor(position / 16) - 8, color }] : []
          })
        : []
    }
    return { walk_1: pixels("walk_1"), walk_2: pixels("walk_2"), happy: pixels("happy") }
  }
  const art = { outgoing: poses(outgoing), incoming: poses(incoming) }
  if (exchangeCache.size > 16) exchangeCache.clear()
  exchangeCache.set(key, art)
  return art
}
