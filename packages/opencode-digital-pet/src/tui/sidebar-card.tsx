import { MONSTER_FRAME_ROWS } from "@jcendal/digital-pet-animation/constants/monster-artwork.ts"
import type {
  MonsterAnimationOutput,
  MonsterAnimationResult,
} from "@jcendal/digital-pet-animation/idle/monster-animation.ts"
import { renderPositionedArtworkRows } from "@jcendal/digital-pet-animation/render/positioned-artwork.ts"
import type { PresentationState } from "@jcendal/digital-pet-animation/sessions/presentation-state.ts"
import type { SidebarCardModel } from "@jcendal/digital-pet-core/view-models/sidebar-view-model.ts"
/** @jsxImportSource @opentui/solid */
import { type BoxRenderable, createTextAttributes, type TextRenderable } from "@opentui/core"
import { type Accessor, createEffect } from "solid-js"
import { IntlModule } from "../i18n.ts"

import { openInBrowser } from "./open-in-browser.ts"

const ARTWORK_ROWS = MONSTER_FRAME_ROWS
const nextCheckPrefix = (): string => IntlModule.translate("sidebarCard.nextCheck")
const urlLabel = (): string => IntlModule.translate("sidebarCard.encyclopediaEntry")
const LINK_ATTRIBUTES = createTextAttributes({ underline: true })
const LINK_COLOR = "#5f87ff"

const formatCount = (value: number): string => value.toLocaleString(IntlModule.locale)

const customArtworkRows = (artwork: string): readonly string[] => {
  const rows = artwork.split("\n")
  if (rows.length >= ARTWORK_ROWS) return rows.slice(0, ARTWORK_ROWS)
  return [...rows, ...Array.from({ length: ARTWORK_ROWS - rows.length }, () => "")]
}

const buildNextCheckLine = (model: SidebarCardModel, width: number): string => {
  if (model.kind === "no_partner") return ""
  if (model.evolutionBattlePending)
    return IntlModule.translate("sidebarCard.evolutionBattle", { NEXT_CHECK_PREFIX: nextCheckPrefix() })
  if (model.isTerminal && !model.isSetOverride)
    return IntlModule.translate("sidebarCard.none", { NEXT_CHECK_PREFIX: nextCheckPrefix() })

  const barWidth = Math.max(width - nextCheckPrefix().length - 2, 0)
  const progress = model.isTerminal ? 1 : Math.min(Math.max(model.gauge / model.threshold, 0), 1)
  const filled = Math.floor(progress * barWidth)
  return `${nextCheckPrefix()}[${"█".repeat(filled)}${"░".repeat(barWidth - filled)}]`
}

export const DigitalPetSidebarCard = (props: {
  readonly model: Accessor<SidebarCardModel>
  readonly animation: Accessor<MonsterAnimationOutput | MonsterAnimationResult>
  readonly presentationState?: Accessor<PresentationState>
  readonly customArtwork?: Accessor<string | undefined>
  readonly onArtworkWidthChange?: (width: number) => void
  readonly onUrlClick?: (url: string) => void
}) => {
  const artwork: (TextRenderable | undefined)[] = Array.from({ length: ARTWORK_ROWS })
  let name: TextRenderable | undefined
  let stage: TextRenderable | undefined
  let nextCheck: TextRenderable | undefined
  let gauge: TextRenderable | undefined
  let url: TextRenderable | undefined
  let artworkWidth: BoxRenderable | undefined
  let nextCheckWidth: BoxRenderable | undefined
  let reportedArtworkWidth: number | undefined

  const updateText = (renderable: TextRenderable | undefined, content: string): void => {
    if (renderable === undefined) return
    renderable.content = content
    renderable.requestRender()
  }

  const handleUrlClick = (): void => {
    const model = props.model()
    if (model.kind !== "partner") return
    ;(props.onUrlClick ?? openInBrowser)(model.url)
  }

  const renderCard = (): void => {
    const model = props.model()
    const width = Math.floor(artworkWidth?.width ?? 0)
    const battleArtwork = props.customArtwork?.()
    const rows =
      battleArtwork === undefined
        ? renderPositionedArtworkRows(props.animation(), width)
        : customArtworkRows(battleArtwork)
    for (const [index, content] of rows.entries()) {
      updateText(artwork[index], content)
    }

    switch (model.kind) {
      case "no_partner":
        updateText(name, model.messageLine)
        updateText(stage, "")
        updateText(nextCheck, "")
        updateText(gauge, "")
        updateText(url, "")
        return
      case "partner": {
        updateText(
          name,
          model.isSetOverride ? IntlModule.translate("sidebarCard.set", { name: model.name }) : model.name,
        )
        updateText(
          stage,
          model.frozen ? IntlModule.translate("sidebarCard.frozen", { stage: model.stage }) : model.stage,
        )
        const phase = props.presentationState?.().phase ?? "idle"
        updateText(
          nextCheck,
          phase === "idle"
            ? buildNextCheckLine(model, nextCheckWidth?.width ?? 0)
            : IntlModule.translate(`phase.${phase}`),
        )
        updateText(gauge, model.isTerminal ? "-/-" : `${formatCount(model.gauge)}/${formatCount(model.threshold)}`)
        updateText(url, urlLabel())
        return
      }
    }
  }

  createEffect(renderCard)

  const reportArtworkWidth = (): void => {
    const width = Math.floor(artworkWidth?.width ?? 0)
    if (width === reportedArtworkWidth) return
    reportedArtworkWidth = width
    props.onArtworkWidthChange?.(width)
    renderCard()
  }

  return (
    <box width="100%" border={["top", "bottom"]} borderStyle="single" flexDirection="column">
      <box
        width="100%"
        height={ARTWORK_ROWS}
        flexDirection="column"
        onSizeChange={reportArtworkWidth}
        ref={(renderable) => {
          artworkWidth = renderable
          renderCard()
        }}
      >
        {Array.from({ length: ARTWORK_ROWS }, (_, index) => (
          <text
            ref={(renderable) => {
              artwork[index] = renderable
              renderCard()
            }}
          />
        ))}
      </box>
      <text
        wrapMode="none"
        truncate
        ref={(renderable) => {
          name = renderable
          renderCard()
        }}
      />
      <text
        wrapMode="none"
        truncate
        ref={(renderable) => {
          stage = renderable
          renderCard()
        }}
      />
      <box
        width="100%"
        onSizeChange={() => renderCard()}
        ref={(renderable) => {
          nextCheckWidth = renderable
          renderCard()
        }}
      >
        <text
          ref={(renderable) => {
            nextCheck = renderable
            renderCard()
          }}
        />
      </box>
      <text
        ref={(renderable) => {
          gauge = renderable
          renderCard()
        }}
      />
      <text
        wrapMode="none"
        truncate
        fg={LINK_COLOR}
        attributes={LINK_ATTRIBUTES}
        onMouseDown={handleUrlClick}
        ref={(renderable) => {
          url = renderable
          renderCard()
        }}
      />
    </box>
  )
}
