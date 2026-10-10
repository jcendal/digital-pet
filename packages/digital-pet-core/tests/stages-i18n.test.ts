import { expect, test } from "bun:test"
import { DIGITAL_PET_STAGE_LABELS } from "../src/config/defaults.ts"
import { getStageLabel, getStageTranslationKey } from "../src/data/stages.ts"
import { catalogs, IntlModule } from "../src/i18n.ts"

test("built-in stages follow the interface locale while custom labels and English naming remain intact", () => {
  try {
    for (const locale of ["es", "gl", "ko"] as const) {
      IntlModule.setLocale(locale)
      expect(getStageLabel(3, DIGITAL_PET_STAGE_LABELS.en)).toBe(catalogs[locale]["stages.child"])
      expect(getStageLabel(3, DIGITAL_PET_STAGE_LABELS.jp)).toBe(catalogs[locale]["stages.child"])
      const custom = { ...DIGITAL_PET_STAGE_LABELS.en, child: "My stage" }
      expect(getStageLabel(3, custom)).toBe("My stage")
      expect(getStageTranslationKey(3, custom)).toBeUndefined()
    }
    IntlModule.setLocale("en")
    expect(getStageLabel(3, DIGITAL_PET_STAGE_LABELS.en)).toBe("Rookie")
    expect(getStageLabel(3, DIGITAL_PET_STAGE_LABELS.jp)).toBe("Child")
  } finally {
    IntlModule.setLocale("en")
  }
})
