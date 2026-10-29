import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { escapeHtml } from "./escape-html.ts"
import { artworkToCenteredPixelArt } from "./pixel-artwork.ts"

/** Trusted catalog artwork; remote peers only supply a validated catalog ID. */
export const companionPortrait = (nodeId: string | null): string => {
  const node = nodeId ? DIGIMON_CATALOG.byId.get(nodeId) : undefined
  const frame = node ? MONSTER_FRAME_CATALOG.get(node.sprite, "walk_1") : undefined
  const art = frame ? artworkToCenteredPixelArt(frame.content, 20) : undefined
  return `<svg class="social-portrait" data-monster-id="${escapeHtml(nodeId ?? "")}" viewBox="${escapeHtml(art?.viewBox ?? "0 0 24 24")}" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="${escapeHtml(art?.path ?? "M9 3h6v6H9zM6 12h12v3h3v6H3v-6h3z")}"/></svg>`
}
