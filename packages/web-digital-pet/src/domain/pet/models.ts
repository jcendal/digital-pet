import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { STAGE_THRESHOLD_KEYS, type StageThresholdSettings } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonStage } from "@jcendal/digital-pet-core/domain/stage.ts"

import { experienceThresholds, type LocalPetState } from "./progress.ts"

export const archiveFor = (state: LocalPetState): DigitalPetArchiveResult => ({
  kind: "available",
  partners: [
    ...(state.retiredPartners ?? []),
    { partnerId: state.partnerId, createdAt: state.createdAt, retiredAt: null, events: state.events },
    ...(state.reserve
      ? [
          {
            partnerId: state.reserve.partnerId,
            createdAt: state.reserve.createdAt,
            retiredAt: null,
            events: state.reserve.events,
          },
        ]
      : []),
  ]
    .sort(
      (first, second) =>
        first.createdAt.localeCompare(second.createdAt) || first.partnerId.localeCompare(second.partnerId),
    )
    .map((partner, index) => ({
      ...partner,
      generation: index + 1,
      events: partner.events.map((event, eventIndex) => ({ eventId: `${partner.partnerId}:${eventIndex}`, ...event })),
    })),
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
