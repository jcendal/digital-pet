import { IntlModule } from "../i18n.ts"
export const DEV_SHOW_MENU_COMMAND = "cursorDigitalPet.dev.showMenu"

/** Keep in sync with `menus.commandPalette` in package.json */
export const DEV_TOOLS_COMMAND_PALETTE_WHEN = "cursorDigitalPet.devToolsEnabled"

export const CURSOR_DEV_ACTIONS = [
  {
    id: "feed",
    get label() {
      return IntlModule.translate("catalog.devFeed")
    },
  },
  {
    id: "evolution_reveal",
    get label() {
      return IntlModule.translate("catalog.devEvolutionReveal")
    },
  },
  {
    id: "evolution_battle",
    get label() {
      return IntlModule.translate("catalog.devEvolutionBattle")
    },
  },
] as const

export type CursorDevActionId = (typeof CURSOR_DEV_ACTIONS)[number]["id"]
