import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import {
  MONSTER_FRAME_CATALOG,
  MONSTER_FRAME_NAMES,
  type MonsterFrameName,
} from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { MonsterAnimationOutput } from "../idle/monster-animation.ts"
import type { EvolutionArtworkScene } from "../sequences/evolution-artwork.ts"
import type { EvolutionBattleScene } from "../sequences/evolution-battle-artwork.ts"

/** Semantic presentation state travels beside the unchanged LCD frame. It contains no gameplay commands. */
export type ArtworkSnapshot =
  | {
      kind: "monster"
      sprite: string
      pose: MonsterFrameName
      width: number
      offset?: number
      facing?: "left" | "right"
      origin?: string
    }
  | { kind: "battle"; player: string; opponent: string; width: number; scene: EvolutionBattleScene }
  | { kind: "evolution"; from: string; to: string; width: number; scene: EvolutionArtworkScene; tick: number }

const identities = new WeakMap<object, { sprite: string; pose: MonsterFrameName }>()
for (const node of DIGIMON_CATALOG.nodes) {
  for (const pose of MONSTER_FRAME_NAMES) {
    const frame = MONSTER_FRAME_CATALOG.get(node.sprite, pose)
    if (frame) identities.set(frame, { sprite: node.sprite, pose })
  }
}

export const snapshotAnimation = (
  output: MonsterAnimationOutput,
  width: number,
  origin?: string,
): ArtworkSnapshot | undefined => {
  if (output.result.kind === "unavailable")
    return { kind: "monster", sprite: output.result.sprite, pose: "walk_1", width }
  if (output.result.kind !== "frame") return undefined
  const identity = identities.get(output.result.frame)
  if (!identity) return undefined
  return {
    kind: "monster",
    ...identity,
    width,
    offset: output.offset,
    facing: output.facing,
    ...(origin ? { origin } : {}),
  }
}
