import type { MonsterFrameCatalog, MonsterFrameName } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { sleep } from "../utils/sleep.ts"
import type { BattleFrameListener } from "./evolution-battle-artwork.ts"

/** Reveal the guardian before normal combat, without exposing the saved outcome or scores. */
export const runAdventureBossIntro = async (
  frames: MonsterFrameCatalog,
  sprite: string,
  width: number,
  onFrame: BattleFrameListener,
): Promise<void> => {
  const poses: readonly MonsterFrameName[] = ["walk_1", "walk_2", "attack"]
  for (const pose of poses) {
    const artwork = (frames.get(sprite, pose) ?? frames.get(sprite, "walk_1"))?.content ?? ""
    const lines = artwork.split("\n")
    const columns = Math.max(...lines.map((line) => line.length))
    const padding = " ".repeat(Math.max(0, Math.floor((width - columns) / 2)))
    await onFrame(lines.map((line) => `${padding}${line}`.padEnd(width, " ")).join("\n"), undefined, {
      kind: "monster",
      sprite,
      pose,
      width,
    })
    await sleep(800)
  }
}
