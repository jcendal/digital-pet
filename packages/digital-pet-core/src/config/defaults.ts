import { catalogs } from "../i18n.ts"
import type { DigitalPetStageLabels, ResolvedDigitalPetSettings, StageLabels, StageThresholdSettings } from "./types.ts"

const EN_STAGE_LABELS = Object.freeze({
  egg: catalogs.en["stages.egg"],
  babyI: catalogs.en["stages.babyI"],
  babyII: catalogs.en["stages.babyII"],
  child: catalogs.en["stages.child"],
  adult: catalogs.en["stages.adult"],
  perfect: catalogs.en["stages.perfect"],
  ultimate: catalogs.en["stages.ultimate"],
  superUltimate: catalogs.en["stages.superUltimate"],
} as const satisfies StageLabels)

const JP_STAGE_LABELS = Object.freeze({
  egg: catalogs.en["legacyStages.egg"],
  babyI: catalogs.en["legacyStages.babyI"],
  babyII: catalogs.en["legacyStages.babyII"],
  child: catalogs.en["legacyStages.child"],
  adult: catalogs.en["legacyStages.adult"],
  perfect: catalogs.en["legacyStages.perfect"],
  ultimate: catalogs.en["legacyStages.ultimate"],
  superUltimate: catalogs.en["legacyStages.superUltimate"],
} as const satisfies StageLabels)

export const DIGITAL_PET_STAGE_LABELS = Object.freeze({
  en: EN_STAGE_LABELS,
  jp: JP_STAGE_LABELS,
} as const satisfies DigitalPetStageLabels)

export const DEFAULT_STAGE_THRESHOLDS = Object.freeze({
  egg: 5_000_000,
  babyI: 10_000_000,
  babyII: 20_000_000,
  child: 40_000_000,
  adult: 75_000_000,
  perfect: 125_000_000,
  ultimate: 200_000_000,
  superUltimate: 300_000_000,
} as const satisfies StageThresholdSettings)

export const DEFAULT_DIGITAL_PET_SETTINGS = Object.freeze({
  language: "jp",
  notifications: true,
  stageLabels: DIGITAL_PET_STAGE_LABELS,
  stageThresholds: DEFAULT_STAGE_THRESHOLDS,
} as const satisfies ResolvedDigitalPetSettings)
