import type { Field } from "../domain/world.ts"
import { IntlModule } from "../i18n.ts"

export const FIELDS: readonly Field[] = Object.freeze([
  {
    id: "nature-spirits",
    get name() {
      return IntlModule.translate("fields.natureSpirits")
    },
    code: "NSp",
    get description() {
      return IntlModule.translate("fields.wildBeastsInsectsMineralsAndPrimitiveCreatures")
    },
  },
  {
    id: "deep-savers",
    get name() {
      return IntlModule.translate("fields.deepSavers")
    },
    code: "DS",
    get description() {
      return IntlModule.translate("fields.aquaticCreaturesOfTheOceansDepthsAndIce")
    },
  },
  {
    id: "nightmare-soldiers",
    get name() {
      return IntlModule.translate("fields.nightmareSoldiers")
    },
    code: "NSo",
    get description() {
      return IntlModule.translate("fields.ghostsDemonsUndeadCreaturesAndDarkMagic")
    },
  },
  {
    id: "wind-guardians",
    get name() {
      return IntlModule.translate("fields.windGuardians")
    },
    code: "WG",
    get description() {
      return IntlModule.translate("fields.birdsAndForestCreaturesOfTheWoodlandAnd")
    },
  },
  {
    id: "metal-empire",
    get name() {
      return IntlModule.translate("fields.metalEmpire")
    },
    code: "ME",
    get description() {
      return IntlModule.translate("fields.machinesCyborgsFactoriesAndIndustrialCities")
    },
  },
  {
    id: "virus-busters",
    get name() {
      return IntlModule.translate("fields.virusBusters")
    },
    code: "VB",
    get description() {
      return IntlModule.translate("fields.sacredGuardiansAndHeroesWhoFightEvil")
    },
  },
  {
    id: "dragons-roar",
    get name() {
      return IntlModule.translate("fields.dragonSRoar")
    },
    code: "DR",
    get description() {
      return IntlModule.translate("fields.dragonsDinosaursAndReptilesOfTheAncientWorld")
    },
  },
  {
    id: "jungle-troopers",
    get name() {
      return IntlModule.translate("fields.jungleTroopers")
    },
    code: "JT",
    get description() {
      return IntlModule.translate("fields.plantsInsectsAndProtectorsOfTheJungle")
    },
  },
  {
    id: "dark-area",
    get name() {
      return IntlModule.translate("fields.darkArea")
    },
    code: "DA",
    get description() {
      return IntlModule.translate("fields.demonicCreaturesDwellingInTheDarkestPlaces")
    },
  },
  {
    id: "unknown",
    get name() {
      return IntlModule.translate("fields.unknown")
    },
    code: "UK",
    get description() {
      return IntlModule.translate("fields.mutantsAnomaliesAndCreaturesThatDefyClassification")
    },
  },
])

// Future fields, intentionally outside the active catalog:
// Saiyu Warriors → Eastern Desert – Server Continent
// Toho Braves → Tonosama Gekomon's Castle
// Celestial Walker → Infinity Mountain
// Astral Sentinel → Vademon's Den
