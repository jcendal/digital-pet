import type { VisualThemeId } from "@jcendal/digital-pet-core/config/theme.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import identities from "@jcendal/digital-pet-core/data/color-sprite-identities.json"
import { MONSTER_FRAME_CATALOG, type MonsterFrameName } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import colorData from "../../assets/themes/color/generated/monsters.json" with { type: "json" }
import { decodePixelRuns, lcdArtworkFrame, type PixelFrame } from "./pixel-frame.ts"
import { VISUAL_THEMES } from "./theme.ts"

type EncodedSprite = Readonly<{
  sprite: string
  palette: readonly (string | null)[]
  frames: Readonly<Record<string, string>>
}>

export type MonsterVisual =
  | Readonly<{ kind: "unavailable"; theme: VisualThemeId; nodeId: string; pose: MonsterFrameName }>
  | Readonly<{
      kind: "frame"
      theme: VisualThemeId
      nodeId: string
      pose: MonsterFrameName
      sourcePose: string
      frame: PixelFrame
      substitution: "none" | "same-species-reaction" | "same-species-idle"
    }>

const encoded = new Map<string, EncodedSprite>(colorData.map((sprite) => [sprite.sprite, sprite]))
const sourceIdentities = new Map(Object.entries(identities.nodes))
const colorFrames = new Map<string, PixelFrame>()
const lcdFrames = new Map<string, PixelFrame>()

const colorPose: Readonly<Record<MonsterFrameName, string>> = Object.freeze({
  angry: "angry",
  attack: "attack_1",
  eat_1: "eat_1",
  eat_2: "eat_2",
  happy: "happy",
  injured_1: "sick",
  injured_2: "refuse",
  refuse: "refuse",
  sleep_1: "sleep_1",
  sleep_2: "sleep_2",
  walk_1: "walk_1",
  walk_2: "walk_2",
})

const unavailable = (theme: VisualThemeId, nodeId: string, pose: MonsterFrameName): MonsterVisual =>
  Object.freeze({ kind: "unavailable", theme, nodeId, pose })

const resolveLcd = (nodeId: string, pose: MonsterFrameName): MonsterVisual => {
  const node = DIGIMON_CATALOG.byId.get(nodeId)
  const source = node && MONSTER_FRAME_CATALOG.get(node.sprite, pose)
  if (!node || !source) return unavailable("lcd", nodeId, pose)
  const key = `${node.sprite}:${pose}`
  let frame = lcdFrames.get(key)
  if (!frame) {
    frame = lcdArtworkFrame(source.content, VISUAL_THEMES.lcd.tokens.ink)
    lcdFrames.set(key, frame)
  }
  return Object.freeze({ kind: "frame", theme: "lcd", nodeId, pose, sourcePose: pose, frame, substitution: "none" })
}

const resolveColor = (nodeId: string, pose: MonsterFrameName): MonsterVisual => {
  const identity = sourceIdentities.get(nodeId)
  const sprite = identity && encoded.get(identity.sprite)
  if (!identity || !sprite) return unavailable("color", nodeId, pose)
  const requested = colorPose[pose]
  const sourcePose = sprite.frames[requested] ? requested : "walk_1"
  const data = sprite.frames[sourcePose]
  if (!data) return unavailable("color", nodeId, pose)
  const key = `${identity.sprite}:${sourcePose}`
  let frame = colorFrames.get(key)
  if (!frame) {
    frame = decodePixelRuns(16, 16, sprite.palette, data)
    colorFrames.set(key, frame)
  }
  return Object.freeze({
    kind: "frame",
    theme: "color",
    nodeId,
    pose,
    sourcePose,
    frame,
    substitution:
      sourcePose !== requested
        ? "same-species-idle"
        : pose === "injured_1" || pose === "injured_2"
          ? "same-species-reaction"
          : "none",
  })
}

const catalogs: Readonly<Record<VisualThemeId, (nodeId: string, pose: MonsterFrameName) => MonsterVisual>> =
  Object.freeze({
    lcd: resolveLcd,
    color: resolveColor,
  })

/** Resolve by save identity, preserving distinct forms even when legacy sprite keys coincide. */
export const resolveMonsterVisual = (theme: VisualThemeId, nodeId: string, pose: MonsterFrameName): MonsterVisual =>
  catalogs[theme](nodeId, pose)
