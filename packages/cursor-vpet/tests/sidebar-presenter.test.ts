import { describe, expect, test } from "bun:test"

import { buildSidebarPresentation } from "../src/webview/sidebar/sidebar-presenter.ts"

describe("sidebar presenter", () => {
  test("builds no_partner payload when snapshot is null", () => {
    const presentation = buildSidebarPresentation(null)
    expect(presentation.payload.kind).toBe("no_partner")
    expect(presentation.partner).toBeUndefined()
  })
})
