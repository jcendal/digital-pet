import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { ResolvedDigitalPetSettings } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { getStageLabel, getStageTranslationKey } from "@jcendal/digital-pet-core/data/stages.ts"
import { IntlModule } from "../../i18n.ts"
import { artworkToPixelPath } from "../../shared/pixel-artwork.ts"

export type HistoryStep = {
  readonly id: string
  readonly name: string
  readonly stage: string
  readonly stageKey?: string
  readonly artwork: string
  readonly createdAt: string
  readonly catalogued: boolean
}

export type HistoryGeneration = {
  readonly partnerId: string
  readonly generation: number
  readonly createdAt: string
  readonly retiredAt: string | null
  readonly steps: readonly HistoryStep[]
}

export type HistoryPanelModel = {
  readonly status: DigitalPetArchiveResult["kind"]
  readonly message: string
  readonly messageKey?: string
  readonly generations: readonly HistoryGeneration[]
}

export const buildHistoryPanelModel = (
  archive: DigitalPetArchiveResult,
  catalog: DigimonCatalog,
  settings: ResolvedDigitalPetSettings,
): HistoryPanelModel => ({
  status: archive.kind,
  messageKey:
    archive.kind === "unavailable"
      ? "webviews:historyClient.couldNotReadPartnerHistory"
      : "webviews:historyModel.noGenerationsYetSpawnAPartnerToStart",
  message:
    archive.kind === "unavailable"
      ? archive.message
      : IntlModule.translate("historyModel.noGenerationsYetSpawnAPartnerToStart"),
  generations:
    archive.kind !== "available"
      ? []
      : archive.partners
          .slice()
          .sort(
            (a, b) =>
              b.createdAt.localeCompare(a.createdAt) ||
              b.generation - a.generation ||
              b.partnerId.localeCompare(a.partnerId),
          )
          .map((partner) => {
            const steps: HistoryStep[] = []
            for (const event of partner.events.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
              if (steps.at(-1)?.id === event.currentNodeId) continue
              const node = catalog.byId.get(event.currentNodeId)
              const frame = node === undefined ? undefined : MONSTER_FRAME_CATALOG.get(node.sprite, "walk_1")
              steps.push({
                id: event.currentNodeId,
                name: node === undefined ? event.currentNodeId : settings.language === "en" ? node.nameEn : node.nameJp,
                stage:
                  node === undefined
                    ? IntlModule.translate("historyModel.unknownStage")
                    : getStageLabel(node.stage, settings.stageLabels[settings.language]),
                ...(node && getStageTranslationKey(node.stage, settings.stageLabels[settings.language])
                  ? { stageKey: getStageTranslationKey(node.stage, settings.stageLabels[settings.language])! }
                  : {}),
                artwork: frame === undefined ? "" : artworkToPixelPath(frame.content),
                createdAt: event.createdAt,
                catalogued: node !== undefined,
              })
            }
            return {
              partnerId: partner.partnerId,
              generation: partner.generation,
              createdAt: partner.createdAt,
              retiredAt: partner.retiredAt,
              steps,
            }
          }),
})
