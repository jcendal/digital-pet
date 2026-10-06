import { describe, expect, test } from "bun:test"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { buildHistoryPanelModel } from "../src/webview/panels/history/history-model.ts"
import { buildHistoryWebviewHtml } from "../src/webview/panels/history/history-render.ts"

describe("Cursor history records", () => {
  test("orders generations and events, merges repeated sightings but preserves returns to a species", () => {
    const model = buildHistoryPanelModel(
      {
        kind: "available",
        partners: [
          {
            partnerId: "old",
            generation: 1,
            createdAt: "2026-09-01T00:00:00Z",
            retiredAt: "2026-10-01T00:00:00Z",
            events: [],
          },
          {
            partnerId: "current",
            generation: 2,
            createdAt: "2026-10-01T00:00:00Z",
            retiredAt: null,
            events: [
              { eventId: "d", currentNodeId: "3-001", createdAt: "2026-10-01T04:00:00Z" },
              { eventId: "b", currentNodeId: "3-001", createdAt: "2026-10-01T02:00:00Z" },
              { eventId: "a", currentNodeId: "3-001", createdAt: "2026-10-01T01:00:00Z" },
              { eventId: "c", currentNodeId: "2-013", createdAt: "2026-10-01T03:00:00Z" },
            ],
          },
        ],
      },
      DIGIMON_CATALOG,
      DEFAULT_DIGITAL_PET_SETTINGS,
    )
    expect(model.generations.map((g) => g.partnerId)).toEqual(["current", "old"])
    expect(model.generations[0]?.steps.map((s) => s.id)).toEqual(["3-001", "2-013", "3-001"])
    expect(model.generations[0]?.steps[0]?.createdAt).toBe("2026-10-01T01:00:00Z")
    expect(model.generations[0]?.steps[0]?.name).toBe("Agumon")
    expect(model.generations[0]?.steps[0]?.artwork).not.toBe("")
    expect(model.generations[1]?.steps).toEqual([])
    expect(model.generations[1]?.retiredAt).toBe("2026-10-01T00:00:00Z")
  })

  test("preserves missing catalog IDs without inventing a species or allowing a Dex destination", () => {
    const model = buildHistoryPanelModel(
      {
        kind: "available",
        partners: [
          {
            partnerId: "a",
            generation: 1,
            createdAt: "2026-10-01",
            retiredAt: null,
            events: [{ eventId: "a", currentNodeId: "removed-node", createdAt: "2026-10-01" }],
          },
        ],
      },
      DIGIMON_CATALOG,
      DEFAULT_DIGITAL_PET_SETTINGS,
    )
    expect(model.generations[0]?.steps[0]).toMatchObject({
      id: "removed-node",
      name: "removed-node",
      artwork: "",
      catalogued: false,
    })
  })

  test("keeps unavailable storage distinct from an empty history and escapes embedded archive data", () => {
    const message = "</script><script>alert('archive')</script>&"
    const model = buildHistoryPanelModel(
      { kind: "unavailable", message },
      DIGIMON_CATALOG,
      DEFAULT_DIGITAL_PET_SETTINGS,
    )
    expect(model.status).toBe("unavailable")
    expect(model.generations).toEqual([])
    expect(buildHistoryPanelModel({ kind: "empty" }, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS).status).toBe(
      "empty",
    )
    const html = buildHistoryWebviewHtml(model, {
      nonce: "testnonce",
      fontUri: "font.ttf",
      cspSource: "https://webview.test",
    })
    expect(html).not.toContain(message)
    expect(html).toContain("script-src 'nonce-testnonce'")
    expect(JSON.parse(html.match(/<script id="history-data"[^>]*>(.*?)<\/script>/s)?.[1] ?? "{}").message).toBe(message)
  })
})
