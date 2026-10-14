import { EGG_FAMILIES } from "@jcendal/digital-pet-core/data/egg-families.ts"
import { MONSTER_FRAME_CATALOG, MonsterFrame } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import digitamas from "../../assets/digitamas/catalog.json" with { type: "json" }
import type { MonsterAnimationOutput } from "../idle/monster-animation.ts"

export const DIGITAMA_ARTWORK = digitamas

/** Source artwork stays at its original 16×16 grid; presentation pads it like other species. */
export const digitamaArtworkForOrigin = (origin: string | undefined) => {
  const family = EGG_FAMILIES.find((family) => family.id === origin)
  return family ? DIGITAMA_ARTWORK.find((egg) => egg.name === family.digitamaDesign) : undefined
}

export const withDigitamaOriginArtwork = (
  frame: MonsterAnimationOutput,
  origin: string | undefined,
): MonsterAnimationOutput => {
  const egg = frame.kind === "digitama" ? digitamaArtworkForOrigin(origin) : undefined
  if (!egg || frame.kind !== "digitama") return frame
  const second = frame.result.frame === MONSTER_FRAME_CATALOG.get("egg", "walk_2")
  return {
    ...frame,
    result: {
      ...frame.result,
      frame: new MonsterFrame(second ? (egg.alternate?.content ?? egg.content) : egg.content),
    },
  }
}
