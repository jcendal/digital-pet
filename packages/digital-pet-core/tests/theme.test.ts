import { expect, test } from "bun:test"
import { normalizeDigitalPetSettings } from "../src/config/normalize.ts"
import { isVisualThemeId, normalizeVisualTheme } from "../src/config/theme.ts"

test("theme normalization accepts only supported identities and preserves legacy defaults", () => {
  for (const value of [undefined, null, true, 0, {}, [], "COLOR", "dark", " color "]) {
    expect(isVisualThemeId(value)).toBe(false)
    expect(normalizeVisualTheme(value)).toBe("lcd")
    expect(normalizeDigitalPetSettings({ theme: value }).theme).toBe("lcd")
  }
  for (const theme of ["lcd", "color"] as const) {
    expect(isVisualThemeId(theme)).toBe(true)
    expect(normalizeDigitalPetSettings({ theme }).theme).toBe(theme)
  }
})

test("a visual preference never changes growth settings or other configuration", () => {
  const input = { language: "en", notifications: false, stageThresholds: { child: 777 } }
  const { theme: lcd, ...before } = normalizeDigitalPetSettings(input)
  const { theme: color, ...after } = normalizeDigitalPetSettings({ ...input, theme: "color" })
  expect(lcd).toBe("lcd")
  expect(color).toBe("color")
  expect(after).toEqual(before)
})

test("an unreadable theme property falls back without discarding valid siblings", () => {
  const input = Object.defineProperty({ language: "en", notifications: false }, "theme", {
    get() {
      throw new Error("unreadable")
    },
  })
  expect(normalizeDigitalPetSettings(input)).toMatchObject({ theme: "lcd", language: "en", notifications: false })
})
