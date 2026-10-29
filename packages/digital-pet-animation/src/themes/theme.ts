import { normalizeVisualTheme, type VisualThemeId } from "@jcendal/digital-pet-core/config/theme.ts"

export type ThemeTokens = Readonly<{
  case: string
  caseEdge: string
  caseInk: string
  screen: string
  screenEdge: string
  ink: string
  muted: string
  line: string
  accent: string
  success: string
  warning: string
  danger: string
}>

/** Host-neutral design values. Asset resolution uses this same theme identity. */
export type VisualTheme = Readonly<{
  id: VisualThemeId
  labelKey: "themes.lcd" | "themes.color"
  tokens: ThemeTokens
}>

export const VISUAL_THEMES: Readonly<Record<VisualThemeId, VisualTheme>> = Object.freeze({
  lcd: Object.freeze({
    id: "lcd",
    labelKey: "themes.lcd",
    tokens: Object.freeze({
      case: "#594130",
      caseEdge: "#9a7750",
      caseInk: "#d6c5a3",
      screen: "#bac79c",
      screenEdge: "#89966f",
      ink: "#26351e",
      muted: "#435334",
      line: "#8fa276",
      accent: "#26351e",
      success: "#26351e",
      warning: "#435334",
      danger: "#26351e",
    }),
  }),
  color: Object.freeze({
    id: "color",
    labelKey: "themes.color",
    tokens: Object.freeze({
      case: "#24364b",
      caseEdge: "#57718b",
      caseInk: "#e6eef5",
      screen: "#edf3f8",
      screenEdge: "#9eb4c6",
      ink: "#172c40",
      muted: "#43596d",
      line: "#b3c5d3",
      accent: "#185b98",
      success: "#25623c",
      warning: "#845315",
      danger: "#a42b35",
    }),
  }),
})

export const resolveVisualTheme = (value: unknown): VisualTheme => VISUAL_THEMES[normalizeVisualTheme(value)]
