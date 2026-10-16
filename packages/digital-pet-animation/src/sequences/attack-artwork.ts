import { ATTACK_ASSIGNMENTS } from "@jcendal/digital-pet-core/data/attack-assignments.ts"
import { DIGIMON_DATA } from "@jcendal/digital-pet-core/data/digimon-data.ts"
import catalog from "../../assets/attacks/catalog.json"

export const ATTACK_ARTWORK = catalog.frames
const frames = new Map(ATTACK_ARTWORK.map((frame) => [`${frame.set}:${frame.index}`, frame.content]))
const sprites = new Map(
  DIGIMON_DATA.flatMap((node) => {
    const assignment = ATTACK_ASSIGNMENTS.get(node.id)
    const content = assignment && frames.get(`${assignment.set}:${assignment.index}`)
    return content ? [[node.sprite, content] as const] : []
  }),
)

/** Source projectiles face right. Mirror the opponent's shot towards the player. */
export const attackArtworkForSprite = (sprite: string, facing: "left" | "right"): readonly string[] | undefined => {
  const content = sprites.get(sprite)
  if (!content) return undefined
  const rows = content.split("\n")
  return facing === "left" ? rows.map((row) => Array.from(row).reverse().join("")) : rows
}
