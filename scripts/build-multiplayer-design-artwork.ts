import { writeFile } from "node:fs/promises"
import { MONSTER_FRAME_CATALOG } from "../packages/digital-pet-core/src/data/monster-frame-catalog.ts"
import { artworkToPixelPath } from "../packages/digital-pet-webviews/src/shared/pixel-artwork.ts"

// Design-only sprite references; production artwork and catalog data remain the source of truth.
const species = ["agumon", "gabumon", "greymon", "tentomon", "patamon", "gatomon"]
const symbols = species.flatMap((name) =>
  (["walk_1", "happy"] as const).map((frame) => {
    const artwork = MONSTER_FRAME_CATALOG.get(name, frame)
    if (!artwork) throw new Error(`Missing design artwork: ${name}/${frame}`)
    const id = frame === "happy" ? `${name}-happy` : name
    return `<symbol id="${id}" viewBox="0 0 16 16"><path d="${artworkToPixelPath(artwork.content)}"/></symbol>`
  }),
)
await writeFile(
  new URL("../assets/design/multiplayer/monsters.svg", import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>\n`,
)
