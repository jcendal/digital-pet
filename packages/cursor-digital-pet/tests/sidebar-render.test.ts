import { Script } from "node:vm"
import { SIDEBAR_SCRIPT } from "../src/webview/sidebar/sidebar-script.ts"
import { describe, expect, test } from "bun:test"

import {
  buildGaugeLine,
  buildNextCheckLine,
  buildSidebarWebviewHtml,
  pixelWidthToArtworkColumns,
  toSidebarWebviewPayload,
} from "../src/webview/sidebar/sidebar-render.ts"

const partnerCard = {
  kind: "partner" as const,
  name: "Agumon",
  sprite: "agumon",
  stage: "Rookie",
  stageNumber: 3,
  url: "https://example.com",
  gauge: 50,
  threshold: 100,
  isTerminal: false,
  frozen: false,
  isSetOverride: false,
  evolutionBattlePending: false,
}

describe("sidebar render", () => {
  test("walking frames keep the arena scale while their pixel position changes", () => {
    const attributes: Record<string, string> = {}
    const pixels: Record<string, string>[] = []
    const element = {
      clientWidth: 300,
      classList: { toggle: () => {} },
      setAttribute: (key: string, value: string) => {
        attributes[key] = value
      },
      replaceChildren: () => {
        pixels.length = 0
      },
      append: (node: Record<string, string>) => {
        pixels.push(node)
      },
    }
    let receive: (event: { data: unknown }) => void = () => {}
    new Script(SIDEBAR_SCRIPT).runInNewContext({
      acquireVsCodeApi: () => ({ postMessage: () => {} }),
      document: {
        getElementById: () => element,
        querySelector: () => element,
        querySelectorAll: () => [],
        createElementNS: () => {
          const node: Record<string, string> = {}
          return Object.assign(node, {
            setAttribute: (key: string, value: string) => {
              node[key] = value
            },
          })
        },
      },
      window: {
        addEventListener: (_name: string, handler: typeof receive) => {
          receive = handler
        },
      },
      ResizeObserver: class {
        observe() {}
      },
    })
    receive({ data: { type: "animation-frame", artwork: " █" } })
    expect(attributes["viewBox"]).toBe("0 0 50 16")
    expect(pixels[0]?.["x"]).toBe("1")
    receive({ data: { type: "animation-frame", artwork: "                              █" } })
    expect(attributes["viewBox"]).toBe("0 0 50 16")
    expect(pixels[0]?.["x"]).toBe("30")
  })

  test("converts pixel width to monospace artwork columns", () => {
    expect(pixelWidthToArtworkColumns(250, 7.5)).toBe(33)
    expect(pixelWidthToArtworkColumns(120, 7.5)).toBe(16)
    expect(pixelWidthToArtworkColumns(10, 7.5)).toBe(16)
  })

  test("builds next check bar for partner progress", () => {
    const line = buildNextCheckLine(partnerCard)

    expect(line).toBe("Next check: [██████████░░░░░░░░░░]")
  })

  test("embeds nonce in sidebar CSP and script tag", () => {
    const html = buildSidebarWebviewHtml("test-nonce-123")
    expect(html).toContain("script-src 'nonce-test-nonce-123'")
    expect(html).toContain('nonce="test-nonce-123"')
  })

  test("maps partner model to sidebar payload without artwork", () => {
    const payload = toSidebarWebviewPayload({
      ...partnerCard,
      url: "https://example.com/agumon",
      gauge: 10,
      threshold: 100,
    })

    expect(payload.kind).toBe("partner")
    if (payload.kind !== "partner") return
    expect(payload.name).toBe("Agumon")
    expect(payload.stage).toBe("Rookie")
    expect("artwork" in payload).toBe(false)
    expect(
      buildGaugeLine({
        ...partnerCard,
        url: "https://example.com/agumon",
        gauge: 10,
        threshold: 100,
      }),
    ).toBe("10/100")
  })
})

test("sidebar frontend script compiles after template interpolation", () => {
  expect(() => new Script(SIDEBAR_SCRIPT)).not.toThrow()
})
