import { beforeAll, describe, expect, mock, test } from "bun:test"

const openedUrls: string[] = []
const executedCommands: string[] = []

beforeAll(() => {
  mock.module("vscode", () => ({
    env: {
      openExternal: async (uri: { toString: () => string }) => {
        openedUrls.push(uri.toString())
      },
    },
    commands: {
      executeCommand: async (command: string) => {
        executedCommands.push(command)
      },
    },
    Uri: {
      joinPath: (_base: unknown, ...parts: string[]) => ({ toString: () => `/extension/${parts.join("/")}` }),
      parse: (value: string) => ({ toString: () => value }),
    },
  }))
})

const loadProvider = async () => {
  const { DigitalPetSidebarProvider } = await import("../../src/webview/sidebar/provider.ts")
  return DigitalPetSidebarProvider
}

const extensionUri = { fsPath: "/extension", scheme: "file", path: "/extension" }

const createStubWebviewView = (visible = true) => {
  let messageHandler: ((message: unknown) => void) | undefined
  const posted: unknown[] = []
  const webview = {
    options: {},
    cspSource: "https://webview.test",
    asWebviewUri: (uri: { toString: () => string }) => uri,
    html: "",
    postMessage: async (message: unknown) => {
      posted.push(message)
    },
    onDidReceiveMessage: (handler: (message: unknown) => void) => {
      messageHandler = handler
      return { dispose: () => undefined }
    },
  }
  const webviewView = {
    visible,
    webview,
    onDidChangeVisibility: () => ({ dispose: () => undefined }),
  }
  return {
    webviewView,
    posted,
    sendMessage: (message: unknown) => messageHandler?.(message),
  }
}

describe("sidebar provider", () => {
  test("egg interactions acknowledge saved rewards and reject a hidden sidebar", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const stub = createStubWebviewView()
    const calls: string[][] = []
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      {
        getSidebarSnapshot: () => ({
          partnerId: "egg",
          currentNodeId: "0-001",
          gauge: 0,
          isTerminal: false,
          frozen: false,
          isSetOverride: false,
          trainerTotalTokens: 0,
          pendingEvolutionTargetId: null,
          battleOpponentNodeId: null,
        }),
      },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      {
        scheduler: { start: () => () => undefined },
        eggPettingService: {
          petEgg: (partnerId, interactionId) => {
            calls.push([partnerId, interactionId])
            return { accepted: true }
          },
        },
      },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    await provider.refresh()
    expect(
      stub.posted.some((message) => (message as { egg?: { partnerId: string; canPet: boolean } }).egg?.canPet === true),
    ).toBe(true)
    stub.sendMessage({ type: "pet-egg", partnerId: "egg", interactionId: "first" })
    await Promise.resolve()
    expect(calls).toEqual([["egg", "first"]])
    expect(stub.posted).toContainEqual({ type: "egg-petted", interactionId: "first", accepted: true })
    stub.webviewView.visible = false
    stub.sendMessage({ type: "pet-egg", partnerId: "egg", interactionId: "hidden" })
    stub.sendMessage({ type: "pet-egg", partnerId: "egg", interactionId: "" })
    await Promise.resolve()
    expect(calls).toHaveLength(1)
    expect(stub.posted).toContainEqual({ type: "egg-petted", interactionId: "hidden", accepted: false })
    provider.dispose()
  })

  test("sidebar actions open only the Dex and History commands", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    executedCommands.length = 0
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    stub.sendMessage({ type: "open-panel", panel: "dex" })
    stub.sendMessage({ type: "open-panel", panel: "history" })
    stub.sendMessage({ type: "open-panel", panel: "arbitrary-command" })
    expect(executedCommands).toEqual(["cursorDigitalPet.dex", "cursorDigitalPet.history"])
    provider.dispose()
  })

  test("resolveWebviewView sets CSP html with a nonce", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    expect(stub.webviewView.webview.html).toContain("Content-Security-Policy")
    expect(stub.webviewView.webview.html).toMatch(/script nonce="[^"]+"/)
  })

  test("open-url message opens the link through vscode", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    openedUrls.length = 0
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    stub.sendMessage({ type: "open-url", url: "https://example.com/agumon" })
    await Promise.resolve()
    expect(openedUrls).toEqual(["https://example.com/agumon"])
  })

  test("invalid inbound messages are ignored", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    stub.sendMessage({ type: "unknown" })
    expect(stub.posted).toEqual([{ type: "presentation-state", state: { phase: "idle" } }])
  })

  test("cached payload is posted when webview resolves", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const stub = createStubWebviewView()
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      {
        getSidebarSnapshot: () => ({
          currentNodeId: "3-001",
          gauge: 10,
          isTerminal: false,
          frozen: false,
          isSetOverride: false,
          trainerTotalTokens: 100,
          pendingEvolutionTargetId: null,
          battleOpponentNodeId: null,
        }),
      },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler: { start: () => () => undefined } },
    )
    await provider.refresh()
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    await Promise.resolve()
    expect(stub.posted.some((message) => (message as { kind?: string }).kind === "partner")).toBe(true)
    stub.posted.length = 0
    stub.sendMessage({ type: "sidebar-ready" })
    await Promise.resolve()
    expect(stub.posted.some((message) => (message as { kind?: string }).kind === "partner")).toBe(true)
    expect(stub.posted.some((message) => (message as { type?: string }).type === "animation-frame")).toBe(true)
  })

  test("dispose stops the animation host scheduler", async () => {
    const DigitalPetSidebarProvider = await loadProvider()
    const state = { stopped: false }
    const scheduler = {
      start: () => () => {
        state.stopped = true
      },
    }
    const provider = new DigitalPetSidebarProvider(
      extensionUri as import("vscode").Uri,
      { getSidebarSnapshot: () => null },
      { getActivePartner: () => null, resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }) },
      { scheduler },
    )
    const stub = createStubWebviewView()
    provider.resolveWebviewView(stub.webviewView as unknown as import("vscode").WebviewView)
    provider.dispose()
    expect(state.stopped).toBe(true)
  })
})
