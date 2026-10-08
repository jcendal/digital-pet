import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { STAGE_THRESHOLD_KEYS, type StageThresholdSettings } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonStage } from "@jcendal/digital-pet-core/domain/stage.ts"

import { experienceThresholds, type LocalPetState } from "./local-progress.ts"

export const archiveFor = (state: LocalPetState): DigitalPetArchiveResult => ({
  kind: "available",
  partners: [
    ...(state.retiredPartners ?? []).map((partner, index) => ({
      ...partner,
      generation: index + 1,
      events: partner.events.map((event, eventIndex) => ({ eventId: `${index}:${eventIndex}`, ...event })),
    })),
    {
      partnerId: state.partnerId,
      generation: (state.retiredPartners?.length ?? 0) + 1,
      createdAt: state.createdAt,
      retiredAt: null,
      events: state.events.map((event, index) => ({ eventId: String(index), ...event })),
    },
  ],
})

export const settingsFor = (state: LocalPetState) => ({
  ...DEFAULT_DIGITAL_PET_SETTINGS,
  stageThresholds: Object.freeze(
    Object.fromEntries(
      STAGE_THRESHOLD_KEYS.map((key, index) => [
        key,
        experienceThresholds(state.experienceLevel)[index as DigimonStage],
      ]),
    ),
  ) as StageThresholdSettings,
})
