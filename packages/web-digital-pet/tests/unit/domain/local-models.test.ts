import { expect, test } from "bun:test"
import { STAGE_THRESHOLD_KEYS } from "@jcendal/digital-pet-core/config/types.ts"
import type { DigimonStage } from "@jcendal/digital-pet-core/domain/stage.ts"
import { settingsFor } from "../../../src/domain/pet/models.ts"
import { experienceThresholds, type LocalPetState } from "../../../src/domain/pet/progress.ts"

test("presentation settings use the same requirements as progression for all stages and difficulty levels", () => {
  for (const experienceLevel of ["low", "normal", "high"] as const) {
    const state: LocalPetState = {
      partnerId: "settings-test",
      createdAt: "2026-01-01T00:00:00.000Z",
      currentNodeId: "0-001",
      gauge: 0,
      isTerminal: false,
      lastTickAt: 0,
      events: [],
      experienceLevel,
    }
    const settings = settingsFor(state)
    for (const [index, key] of STAGE_THRESHOLD_KEYS.entries())
      expect(settings.stageThresholds[key]).toBe(experienceThresholds(experienceLevel)[index as DigimonStage])
    expect(Object.isFrozen(settings.stageThresholds)).toBe(true)
  }
})
