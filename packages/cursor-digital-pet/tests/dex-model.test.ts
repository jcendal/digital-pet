import { describe, expect, test } from "bun:test"

import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"

import { artworkToPixelPath } from "../src/webview/shared/pixel-artwork.ts"
import { buildDexPanelModel } from "../src/webview/panels/dex/dex-model.ts"
import { buildDexWebviewHtml } from "../src/webview/panels/dex/dex-render.ts"

const archive: DigitalPetArchiveResult = {
  kind: "available",
  partners: [
    {
      partnerId: "first",
      generation: 1,
      createdAt: "2026-09-01T00:00:00Z",
      retiredAt: "2026-09-04T00:00:00Z",
      events: [
        { eventId: "a", currentNodeId: "3-001", createdAt: "2026-09-03T00:00:00Z" },
        { eventId: "b", currentNodeId: "3-001", createdAt: "2026-09-03T01:00:00Z" },
      ],
    },
    {
      partnerId: "second",
      generation: 2,
      createdAt: "2026-09-04T00:00:00Z",
      retiredAt: null,
      events: [{ eventId: "c", currentNodeId: "3-001", createdAt: "2026-09-05T00:00:00Z" }],
    },
  ],
}

describe("Cursor Digidex records", () => {
  test("empty and unavailable archives still show every catalog slot without revealing species", () => {
    for (const result of [{ kind: "empty" }, { kind: "unavailable", message: "Cannot read archive" }] as const) {
      const model = buildDexPanelModel(result, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
      expect(model.status).toBe(result.kind)
      expect(model.entries).toHaveLength(DIGIMON_CATALOG.nodes.length)
      expect(model.discovered).toBe(0)
      for (const entry of model.entries) {
        expect(entry.name).toBe("Unknown Digimon")
        expect(entry.alternateName).toBe("")
        expect(entry.artwork).toBe("")
        expect(entry.url).toBe("")
        expect(entry.nextIds).toEqual([])
        expect(entry.previousIds).toEqual([])
      }
    }
  })

  test("registration counts distinct generations and keeps the earliest sighting", () => {
    const model = buildDexPanelModel(archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
    const agumon = model.entries.find((entry) => entry.id === "3-001")
    expect(model.discovered).toBe(1)
    expect(agumon?.name).toBe("Agumon")
    expect(agumon?.generations).toBe(2)
    expect(agumon?.firstSeen).toBe("2026-09-03T00:00:00Z")
    expect(agumon?.artwork).not.toBe("")
    expect(agumon?.nextIds).toEqual(DIGIMON_CATALOG.byId.get("3-001")?.nextEvolutions)
    expect(agumon?.previousIds).toContain("2-013")
    expect(model.entries.find((entry) => entry.id === agumon?.nextIds[0])?.name).toBe("Unknown Digimon")
  })

  test("half blocks are reconstructed into separate square pixels", () => {
    expect(artworkToPixelPath("▀▄█ ")).toBe("M0 0h1v1h-1zM1 1h1v1h-1zM2 0h1v1h-1zM2 1h1v1h-1z")
    expect(artworkToPixelPath(" \n▄")).toBe("M0 3h1v1h-1z")
  })

  test("embedded model data cannot terminate the JSON script or execute catalog markup", () => {
    const model = buildDexPanelModel(archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
    const malicious = "</script><script>alert('catalog')</script>"
    const html = buildDexWebviewHtml(
      { ...model, message: malicious },
      {
        nonce: "testnonce",
        fontUri: "https://webview.test/font.ttf",
        cspSource: "https://webview.test",
      },
    )
    expect(html).not.toContain(malicious)
    expect(html).toContain("script-src 'nonce-testnonce'")
    const data = html.match(/<script id="dex-data"[^>]*>(.*?)<\/script>/s)?.[1]
    expect(JSON.parse(data ?? "{}").message).toBe(malicious)
    expect(html).not.toContain("https://fonts.googleapis.com")
  })
})
