import { describe, expect, it } from "bun:test"

import { isBrowserSaveSelected, resolveSaveSource } from "../../../src/client/platform/save-source.ts"

describe("web save selection", () => {
  it("respects the chosen save even when an older tab writes a stale active source", () => {
    expect(isBrowserSaveSelected("browser", "sqlite")).toBe(true)
    expect(isBrowserSaveSelected("sqlite", "browser")).toBe(false)
    expect(isBrowserSaveSelected(null, "browser")).toBe(true)
    expect(isBrowserSaveSelected(null, "sqlite")).toBe(false)
  })
  it("defaults to the computer when available and allows a separate browser save", () => {
    expect(resolveSaveSource(null, true, null)).toBe("sqlite")
    expect(resolveSaveSource("browser", true, "sqlite")).toBe("browser")
    expect(resolveSaveSource("sqlite", true, "browser")).toBe("sqlite")
  })

  it("uses the browser when no computer save exists and preserves explicit choices offline", () => {
    expect(resolveSaveSource("sqlite", false, "sqlite")).toBe("browser")
    expect(resolveSaveSource("browser", null, "sqlite")).toBe("browser")
    expect(resolveSaveSource("sqlite", null, "browser")).toBe("sqlite")
    expect(resolveSaveSource(null, null, "browser")).toBe("browser")
  })
})
