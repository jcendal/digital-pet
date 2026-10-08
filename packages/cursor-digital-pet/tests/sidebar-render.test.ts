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

class PreviewElement {
  readonly attributes: Record<string, string> = {}
  readonly children: PreviewElement[] = []
  readonly style: Record<string, string> = {}
  readonly dataset: Record<string, string> = {}
  readonly classes = new Set<string>()
  readonly classList = {
    toggle: (name: string, enabled: boolean) => {
      if (enabled) this.classes.add(name)
      else this.classes.delete(name)
    },
  }
  clientWidth = 300
  hidden = false
  className = ""
  textContent = ""
  title = ""
  setAttribute(key: string, value: string) {
    this.attributes[key] = value
  }
  replaceChildren() {
    this.children.length = 0
  }
  append(node: PreviewElement) {
    this.children.push(node)
  }
}

const sidebarPreview = (idleAlignment?: string) => {
  const nodes = new Map<string, PreviewElement>()
  const element = (id: string) => {
    let node = nodes.get(id)
    if (node === undefined) {
      node = new PreviewElement()
      nodes.set(id, node)
    }
    return node
  }
  if (idleAlignment !== undefined) element("artwork").dataset.idleAlignment = idleAlignment
  let receive: (event: { data: unknown }) => void = () => {}
  new Script(SIDEBAR_SCRIPT).runInNewContext({
    acquireVsCodeApi: () => ({ postMessage: () => {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "6" }),
    document: {
      getElementById: element,
      querySelector: element,
      querySelectorAll: () => [],
      createElement: () => new PreviewElement(),
      createElementNS: () => new PreviewElement(),
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
  return { element, send: (data: unknown) => receive({ data }) }
}

describe("sidebar render", () => {
  test("walking frames keep the arena scale while their pixel position changes", () => {
    const { element, send } = sidebarPreview()
    send({ type: "animation-frame", artwork: " █" })
    expect(element("artwork").attributes.viewBox).toBe("0 0 50 16")
    expect(element("artwork").children[0]?.attributes.x).toBe("1")
    send({ type: "animation-frame", artwork: "                              █" })
    expect(element("artwork").attributes.viewBox).toBe("0 0 50 16")
    expect(element("artwork").children[0]?.attributes.x).toBe("30")
    expect(element("artwork").attributes.preserveAspectRatio).toBe("xMidYMid meet")
  })

  test("a grounded web partner moves to the center for the intro and combat, then returns to walking", () => {
    const { element, send } = sidebarPreview("xMidYMax")
    send({ type: "animation-frame", artwork: "█" })
    expect(element("artwork").attributes.preserveAspectRatio).toBe("xMidYMax meet")
    send({ type: "presentation-state", state: { phase: "battle", fromNodeId: "3-001", opponentNodeId: "3-051" } })
    send({ type: "animation-frame", artwork: "█\n█\n█\n█\n█\n█" })
    expect(element(".pet-module").classes.has("battle-intro")).toBe(true)
    expect(element("artwork").attributes.viewBox).toBe("0 0 50 12")
    expect(element("artwork").attributes.preserveAspectRatio).toBe("xMidYMid meet")
    send({ type: "presentation-state", state: { phase: "idle" } })
    expect(element(".pet-module").classes.has("battle-intro")).toBe(false)
    expect(element("artwork").attributes.preserveAspectRatio).toBe("xMidYMax meet")
  })

  test("battle HUD shows both names and scores without duplicating ASCII HUD pixels, then clears on evolution", () => {
    const { element, send } = sidebarPreview()
    send({ ...toSidebarWebviewPayload(partnerCard), opponentName: "Gabumon" })
    send({ type: "presentation-state", state: { phase: "battle", fromNodeId: "3-001", opponentNodeId: "3-051" } })
    send({
      type: "animation-frame",
      artwork: "█               █░░      ██░\n\n\n\n\n\n\n                HIT!",
      hud: {
        playerHits: 1,
        opponentHits: 2,
        hitsToWin: 3,
        caption: "HIT!",
        gapStartColumn: 16,
        gapColumns: 12,
        scoreRow: 0,
        captionRow: 7,
      },
    })
    expect(element("name").textContent).toBe("Agumon")
    expect(element("stage").textContent).toBe("Gabumon")
    expect(element("player-score").children.map((node) => node.className)).toEqual([
      "score-pip filled",
      "score-pip",
      "score-pip",
    ])
    expect(element("opponent-score").children.map((node) => node.className)).toEqual([
      "score-pip filled",
      "score-pip filled",
      "score-pip",
    ])
    expect(element("battle-caption").textContent).toBe("HIT!")
    expect(element(".pet-module").classes.has("battle-intro")).toBe(false)
    expect(element("artwork").attributes.preserveAspectRatio).toBe("xMidYMid meet")
    expect(element("artwork").children.map((node) => node.attributes.x)).toEqual(["0", "0"])
    send({ type: "presentation-state", state: { phase: "evolving", fromNodeId: "3-001", toNodeId: "4-017" } })
    expect(element("battle-scores").hidden).toBe(true)
    expect(element("battle-caption").hidden).toBe(true)
    send({ type: "presentation-state", state: { phase: "idle" } })
    expect(element("stage").textContent).toBe("Rookie")
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

  test("keeps the Cursor partner sidebar without the web device frame", () => {
    const cursorHtml = buildSidebarWebviewHtml("cursor")
    const webHtml = buildSidebarWebviewHtml("web", { fontUri: "font.ttf", cspSource: "'self'", webShell: true })

    expect(cursorHtml).toContain('<main class="pet-module" aria-label="Digital Pet">')
    expect(cursorHtml).not.toContain('class="device partner-device"')
    expect(cursorHtml).not.toContain('class="masthead"')
    expect(webHtml).toContain('class="device partner-device"')
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
