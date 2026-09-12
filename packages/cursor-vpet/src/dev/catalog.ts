export const DEV_SHOW_MENU_COMMAND = "cursorVpet.dev.showMenu"

/** Keep in sync with `menus.commandPalette` in package.json */
export const DEV_TOOLS_COMMAND_PALETTE_WHEN = "cursorVpet.devToolsEnabled"

export const CURSOR_DEV_ACTIONS = [
  { id: "feed", label: "Dev Feed" },
  { id: "evolution_reveal", label: "Dev Evolution Reveal" },
  { id: "evolution_battle", label: "Dev Evolution Battle" },
] as const

export type CursorDevActionId = (typeof CURSOR_DEV_ACTIONS)[number]["id"]
