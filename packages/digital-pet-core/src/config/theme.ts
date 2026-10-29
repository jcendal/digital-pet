/** Presentation preferences are local to a host, never part of a companion save. */
export const VISUAL_THEME_IDS = Object.freeze(["lcd", "color"] as const)
export type VisualThemeId = (typeof VISUAL_THEME_IDS)[number]
export const DEFAULT_VISUAL_THEME: VisualThemeId = "lcd"

export const isVisualThemeId = (value: unknown): value is VisualThemeId => value === "lcd" || value === "color"

export const normalizeVisualTheme = (value: unknown): VisualThemeId =>
  isVisualThemeId(value) ? value : DEFAULT_VISUAL_THEME
