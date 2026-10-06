import type { SidebarCardModel } from "@jcendal/digital-pet-core/view-models/sidebar-view-model.ts"

import {
  DEFAULT_ARTWORK_WIDTH,
  MIN_ARTWORK_WIDTH,
  NEXT_CHECK_BAR_WIDTH,
  NEXT_CHECK_PREFIX,
  SIDEBAR_URL_LABEL,
} from "../../shared/constants/sidebar-ui.ts"
import type { SidebarWebviewPayload } from "./webview-messages.ts"

export type { AnimationFramePayload, SidebarWebviewPayload } from "./webview-messages.ts"

export const pixelWidthToArtworkColumns = (pixelWidth: number, charWidthPx: number): number => {
  if (!Number.isFinite(pixelWidth) || pixelWidth <= 0) return DEFAULT_ARTWORK_WIDTH
  if (!Number.isFinite(charWidthPx) || charWidthPx <= 0) return DEFAULT_ARTWORK_WIDTH
  return Math.max(MIN_ARTWORK_WIDTH, Math.floor(pixelWidth / charWidthPx))
}

const formatCount = (value: number): string => value.toLocaleString("en-US")

export const buildNextCheckLine = (model: SidebarCardModel): string => {
  if (model.kind === "no_partner") return ""
  if (model.isTerminal && !model.isSetOverride) return `${NEXT_CHECK_PREFIX}None`
  if (model.evolutionBattlePending) return `${NEXT_CHECK_PREFIX}Evolution battle!`

  const progress = model.isTerminal ? 1 : Math.min(Math.max(model.gauge / model.threshold, 0), 1)
  const filled = Math.floor(progress * NEXT_CHECK_BAR_WIDTH)
  return `${NEXT_CHECK_PREFIX}[${"█".repeat(filled)}${"░".repeat(NEXT_CHECK_BAR_WIDTH - filled)}]`
}

export const buildGaugeLine = (model: SidebarCardModel): string => {
  if (model.kind !== "partner") return ""
  return model.isTerminal ? "-/-" : `${formatCount(model.gauge)}/${formatCount(model.threshold)}`
}

export const toSidebarWebviewPayload = (model: SidebarCardModel): SidebarWebviewPayload => {
  if (model.kind === "no_partner") {
    return { type: "sidebar-model", kind: "no_partner", messageLine: model.messageLine }
  }

  return {
    type: "sidebar-model",
    kind: "partner",
    progress: model.isTerminal ? 1 : model.threshold > 0 ? Math.min(Math.max(model.gauge / model.threshold, 0), 1) : 0,
    terminal: model.isTerminal && !model.isSetOverride,
    name: model.isSetOverride ? `${model.name} (set)` : model.name,
    stage: model.frozen ? `${model.stage} (frozen)` : model.stage,
    nextCheck: buildNextCheckLine(model),
    gauge: buildGaugeLine(model),
    url: model.url,
    urlLabel: SIDEBAR_URL_LABEL,
    frozen: model.frozen,
  }
}

export { buildSidebarWebviewHtml } from "./sidebar-document.ts"
