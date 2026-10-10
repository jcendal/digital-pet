import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import type { PartnerHygieneService } from "@jcendal/digital-pet-core/application/use-cases/care-for-partner.ts"
import type { EvolutionBattleRepository } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import { CLEANING_HAPPY_MS, type HygieneView, hygieneMood } from "@jcendal/digital-pet-core/domain/hygiene.ts"
import * as vscode from "vscode"

import { type AnimationSink, createAnimationSink } from "../../adapters/vscode/animation-sink.ts"
import { createVsCodeNotificationPort, type NotificationPort } from "../../adapters/vscode/notification-port.ts"
import { createIntervalScheduler, type IntervalScheduler } from "../../adapters/vscode/scheduler.ts"
import { createWebviewMessenger } from "../../adapters/vscode/webview-messenger.ts"
import { createSidebarAnimationHost, type SidebarAnimationHost } from "./sidebar-animation-host.ts"
import { createSidebarOrchestrator, type SidebarOrchestrator } from "./sidebar-orchestrator.ts"
import { buildSidebarWebviewHtml } from "./sidebar-render.ts"
import { parseWebviewInboundMessage } from "./webview-messages.ts"

export type DigitalPetSidebarProviderOptions = {
  readonly notification?: NotificationPort
  readonly scheduler?: IntervalScheduler
  readonly random?: () => number
  readonly nowMs?: () => number
  readonly hygieneService?: PartnerHygieneService
}

const createDeferredAnimationSink = (): { readonly sink: AnimationSink; setSink(next: AnimationSink): void } => {
  let current: AnimationSink = {
    postArtwork: async () => {},
    postModel: async () => {},
  }
  return {
    sink: {
      postState: async (state) => current.postState?.(state),
      postArtwork: async (artwork, hud) => current.postArtwork(artwork, hud),
      postModel: async (payload) => current.postModel(payload),
    },
    setSink(next: AnimationSink): void {
      current = next
    },
  }
}

export class DigitalPetSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorDigitalPet.sidebar"

  private view?: vscode.WebviewView
  private readonly notification: NotificationPort
  private readonly scheduler: IntervalScheduler
  private readonly animationHost: SidebarAnimationHost
  private readonly orchestrator: SidebarOrchestrator
  private readonly deferredSink: ReturnType<typeof createDeferredAnimationSink>
  private happyTimer: ReturnType<typeof setTimeout> | undefined
  private hygieneView: HygieneView | undefined

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly snapshotReader: SidebarSnapshotReader,
    battleRepository: EvolutionBattleRepository,
    private readonly options: DigitalPetSidebarProviderOptions = {},
  ) {
    this.notification = options.notification ?? createVsCodeNotificationPort()
    this.scheduler = options.scheduler ?? createIntervalScheduler()
    const random = options.random ?? Math.random
    const nowMs = options.nowMs ?? (() => performance.now())
    this.deferredSink = createDeferredAnimationSink()

    this.animationHost = createSidebarAnimationHost({
      frameCatalog: MONSTER_FRAME_CATALOG,
      sink: this.deferredSink.sink,
      scheduler: this.scheduler,
      random,
      nowMs,
      isVisible: () => this.view?.visible === true,
    })

    this.orchestrator = createSidebarOrchestrator({
      snapshotReader,
      battleRepository,
      animationHost: this.animationHost,
      readHygiene: () => this.hygieneView,
      notification: this.notification,
      random,
      onPresentationEnd: () => {
        if (this.view?.visible === true) this.animationHost.start()
      },
    })
    this.orchestrator.setSink(this.deferredSink.sink)
  }

  isPresentationInProgress(): boolean {
    return this.orchestrator.isPresentationInProgress()
  }

  queueEvolutionReveal(evolution: Parameters<SidebarOrchestrator["queueEvolutionReveal"]>[0]): void {
    this.orchestrator.queueEvolutionReveal(evolution)
  }

  playFeedAnimation(): void {
    if (this.orchestrator.isPresentationInProgress()) return
    this.animationHost.playFeedAnimation()
  }

  async refresh(): Promise<void> {
    const saved = this.options.hygieneService?.refreshHygiene(Date.now())
    const snapshot = this.options.hygieneService ? this.snapshotReader.getSidebarSnapshot() : undefined
    this.hygieneView = saved
      ? {
          partnerId: saved.partnerId,
          poops: saved.hygiene.poops,
          mood: hygieneMood(saved.hygiene, Date.now()),
          canClean: !this.isPresentationInProgress() && !snapshot?.frozen && !snapshot?.pendingEvolutionTargetId,
        }
      : undefined
    await this.orchestrator.refresh()
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    const sink = createAnimationSink(createWebviewMessenger(webviewView.webview))
    this.deferredSink.setSink(sink)
    this.orchestrator.setSink(sink)

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist", "assets")],
    }

    webviewView.webview.html = buildSidebarWebviewHtml(String(Date.now()), {
      fontUri: webviewView.webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "assets", "fonts", "Silkscreen-Regular.ttf"))
        .toString(),
      cspSource: webviewView.webview.cspSource,
    })

    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      const inbound = parseWebviewInboundMessage(message)
      if (inbound === null) return
      if (inbound.type === "clean-poop") {
        if (!this.isPresentationInProgress())
          this.options.hygieneService?.cleanPoop(inbound.partnerId, inbound.poopId, Date.now())
        void this.refresh()
        clearTimeout(this.happyTimer)
        this.happyTimer = setTimeout(() => {
          void this.refresh()
        }, CLEANING_HAPPY_MS)
        return
      }
      if (inbound.type === "sidebar-ready") {
        this.orchestrator.setSink(sink)
        const payload = this.orchestrator.getCachedPayload()
        if (payload !== undefined) void sink.postModel(payload)
        this.animationHost.clearArtwork()
        void this.animationHost.postCurrentFrame()
        return
      }
      if (inbound.type === "open-panel") {
        void vscode.commands.executeCommand(
          inbound.panel === "dex" ? "cursorDigitalPet.dex" : "cursorDigitalPet.history",
        )
        return
      }
      if (inbound.type === "open-url") {
        void vscode.env.openExternal(vscode.Uri.parse(inbound.url))
        return
      }
      this.animationHost.setArtworkWidth(inbound.width)
      void this.animationHost.postCurrentFrame()
    })

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.animationHost.start()
        void this.refresh()
      } else {
        this.animationHost.stop()
      }
    })

    const cachedPayload = this.orchestrator.getCachedPayload()
    if (cachedPayload !== undefined) {
      void sink.postModel(cachedPayload)
    }

    if (webviewView.visible) {
      this.animationHost.start()
      void this.refresh()
    }
  }

  dispose(): void {
    clearTimeout(this.happyTimer)
    this.animationHost.stop()
    delete this.view
  }
}
