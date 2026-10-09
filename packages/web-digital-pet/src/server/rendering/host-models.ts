import { MonsterAnimationController } from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { renderPositionedArtwork } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { buildDexPanelModel } from "@jcendal/digital-pet-webviews/panels/dex/dex-model.ts"
import { buildHistoryPanelModel } from "@jcendal/digital-pet-webviews/panels/history/history-model.ts"
import { buildSidebarPresentation } from "@jcendal/digital-pet-webviews/sidebar/sidebar-presenter.ts"
import { sceneMotionFor } from "../../shared/scene-motion.ts"
import { readArchive, readSidebarSnapshot } from "../persistence/sqlite.ts"

const animation = new MonsterAnimationController(MONSTER_FRAME_CATALOG)
let currentPartner = ""

export const dexModel = () => ({
  ...buildDexPanelModel(readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS),
  currentNodeId: readSidebarSnapshot()?.currentNodeId ?? null,
})
export const historyModel = () => buildHistoryPanelModel(readArchive(), DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)

export const sidebarData = (requestedWidth: number) => {
  const presentation = buildSidebarPresentation(readSidebarSnapshot())
  const identity = presentation.partner
  const partnerKey = identity ? `${identity.sprite}:${identity.isDigitama}` : ""
  if (partnerKey !== currentPartner) {
    currentPartner = partnerKey
    animation.dispatch({ kind: "partner_changed", partner: identity })
  }
  const width = Math.max(16, Math.min(120, Math.floor(requestedWidth) || 40))
  animation.dispatch({ kind: "viewport_resized", width })
  const frame = animation.dispatch({ kind: "tick" })
  return {
    model: presentation.payload,
    frame: {
      type: "animation-frame",
      artwork: renderPositionedArtwork(frame, width),
      motion: sceneMotionFor(frame, partnerKey, width),
    },
  }
}
