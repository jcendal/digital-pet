import { IntlModule } from "../i18n.ts"
export const OPENCODE_DEV_ACTIONS = [
  {
    id: "feed",
    get title() {
      return IntlModule.translate("catalog.digitalPetDevFeed")
    },
    slashName: "digital-pet-dev-feed",
  },
  {
    id: "activity",
    get title() {
      return IntlModule.translate("catalog.digitalPetDevActivity")
    },
    slashName: "digital-pet-dev-activity",
  },
  {
    id: "evolution_reveal",
    get title() {
      return IntlModule.translate("catalog.digitalPetDevEvolutionReveal")
    },
    slashName: "digital-pet-dev-evolution-reveal",
  },
  {
    id: "evolution_battle",
    get title() {
      return IntlModule.translate("catalog.digitalPetDevEvolutionBattle")
    },
    slashName: "digital-pet-dev-evolution-battle",
  },
  {
    id: "defeat",
    get title() {
      return IntlModule.translate("catalog.digitalPetDevDefeatViaBattle")
    },
    slashName: "digital-pet-dev-defeat",
  },
] as const

export type OpencodeDevActionId = (typeof OPENCODE_DEV_ACTIONS)[number]["id"]
