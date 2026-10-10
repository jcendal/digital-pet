import type { StageLabels, StageThresholdKey } from "../config/types.ts"
import { DIGIMON_STAGES, type DigimonStage, isDigimonStage } from "../domain/stage.ts"
import { catalogs, IntlModule } from "../i18n.ts"

export { type DigimonStage, isDigimonStage }

export const STAGE_VALUES = DIGIMON_STAGES

export const STAGE_THRESHOLD_KEYS = {
  0: "egg",
  1: "babyI",
  2: "babyII",
  3: "child",
  4: "adult",
  5: "perfect",
  6: "ultimate",
  7: "superUltimate",
} as const satisfies Record<DigimonStage, StageThresholdKey>

export const getStageKey = (stage: DigimonStage): StageThresholdKey => STAGE_THRESHOLD_KEYS[stage]

export const getStageTranslationKey = (stage: DigimonStage, labels: StageLabels): string | undefined => {
  const key = getStageKey(stage)
  const label = labels[key]
  const builtIn =
    label === catalogs.en[`stages.${key}` as keyof typeof catalogs.en] ||
    label === catalogs.en[`legacyStages.${key}` as keyof typeof catalogs.en]
  return builtIn ? `stages.${key}` : undefined
}
export const getStageLabel = (stage: DigimonStage, labels: StageLabels): string => {
  const key = getStageTranslationKey(stage, labels)
  return key && IntlModule.locale !== "en" ? IntlModule.translate(key) : labels[getStageKey(stage)]
}
