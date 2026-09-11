import * as vscode from "vscode"

import type { UsageEvolutionTransition } from "@sbugallo/vpet-core/application/models/usage.ts"
import { DEFAULT_VPET_SETTINGS } from "@sbugallo/vpet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@sbugallo/vpet-core/data/monster-frame-catalog.ts"
import { getSidebarCardInputs } from "@sbugallo/vpet-core/application/use-cases/get-sidebar-card-inputs.ts"
import type { SidebarSnapshotReader } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import type { EvolutionBattleRepository } from "@sbugallo/vpet-core/application/use-cases/resolve-evolution-battle.ts"
import { buildSidebarCardModel } from "@sbugallo/vpet-core/view-models/sidebar-view-model.ts"
import { createAnimationSink, type AnimationSink } from "../adapters/vscode/animation-sink.ts"
import {
  createVsCodeNotificationPort,
  type NotificationPort,
} from "../adapters/vscode/notification-port.ts"
import { createIntervalScheduler, type IntervalScheduler } from "../adapters/vscode/scheduler.ts"
import { createWebviewMessenger } from "../adapters/vscode/webview-messenger.ts"
import { createAsyncRefreshQueue } from "../shared/async-refresh-queue.ts"
import { renderPositionedArtwork } from "./presentation/animated-artwork.ts"
import { runEvolutionBattleSession } from "./presentation/evolution-battle-session.ts"
import { runEvolutionRevealSession } from "./presentation/evolution-reveal-session.ts"
import { MonsterAnimationController, type MonsterAnimationOutput } from "./presentation/monster-animation.ts"
import { parseWebviewInboundMessage, type SidebarWebviewPayload } from "./sidebar/webview-messages.ts"
import {
  buildSidebarWebviewHtml,
  DEFAULT_ARTWORK_WIDTH,
  MIN_ARTWORK_WIDTH,
  toSidebarWebviewPayload,
} from "./sidebar-render.ts"

const VISUAL_INTERVAL_MS = 500

export type VpetSidebarProviderOptions = {
  readonly notification?: NotificationPort
  readonly scheduler?: IntervalScheduler
  readonly random?: () => number
  readonly nowMs?: () => number
}

export class VpetSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cursorVpet.sidebar"

  private view?: vscode.WebviewView
  private messengerSink?: AnimationSink
  private cachedPayload?: SidebarWebviewPayload
  private cachedArtwork = ""
  private artworkWidth = DEFAULT_ARTWORK_WIDTH
  private stopVisualInterval?: () => void
  private presentationInProgress = false
  private pendingEvolutionReveal: UsageEvolutionTransition | undefined
  private readonly refreshQueue = createAsyncRefreshQueue()
  private readonly notification: NotificationPort
  private readonly scheduler: IntervalScheduler
  private readonly random: () => number
  private readonly nowMs: () => number
  private readonly animation: MonsterAnimationController

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly snapshotReader: SidebarSnapshotReader,
    private readonly battleRepository: EvolutionBattleRepository,
    options: VpetSidebarProviderOptions = {},
  ) {
    this.notification = options.notification ?? createVsCodeNotificationPort()
    this.scheduler = options.scheduler ?? createIntervalScheduler()
    this.random = options.random ?? Math.random
    this.nowMs = options.nowMs ?? (() => performance.now())
    this.animation = new MonsterAnimationController(MONSTER_FRAME_CATALOG, this.random, this.nowMs)
  }

  isPresentationInProgress(): boolean {
    return this.presentationInProgress
  }

  queueEvolutionReveal(evolution: UsageEvolutionTransition): void {
    this.pendingEvolutionReveal = evolution
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    this.messengerSink = createAnimationSink(createWebviewMessenger(webviewView.webview))
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }

    webviewView.webview.html = buildSidebarWebviewHtml(String(Date.now()))

    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      const inbound = parseWebviewInboundMessage(message)
      if (inbound === null) return
      if (inbound.type === "open-url") {
        void vscode.env.openExternal(vscode.Uri.parse(inbound.url))
        return
      }
      this.artworkWidth = Math.max(MIN_ARTWORK_WIDTH, Math.floor(inbound.width))
      this.syncAnimationViewport()
      void this.postAnimationFrame()
    })

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.startVisualInterval()
        void this.refresh()
      } else {
        this.stopVisualInterval?.()
        delete this.stopVisualInterval
      }
    })

    if (this.cachedPayload !== undefined) {
      void this.messengerSink?.postModel(this.cachedPayload)
    }
    if (this.cachedArtwork.length > 0) {
      void this.messengerSink?.postArtwork(this.cachedArtwork)
    }

    if (webviewView.visible) {
      this.startVisualInterval()
      void this.refresh()
    }
  }

  async refresh(): Promise<void> {
    if (this.view === undefined) return
    await this.refreshQueue.run(async () => {
      await this.resolvePendingBattleIfNeeded()
      await this.playPendingEvolutionReveal()
      if (this.view === undefined) return
      await this.publishSidebarModel()
    })
  }

  dispose(): void {
    this.stopVisualInterval?.()
    delete this.stopVisualInterval
    delete this.view
    delete this.messengerSink
  }

  private async publishSidebarModel(): Promise<void> {
    if (this.view === undefined || this.messengerSink === undefined) return

    const snapshot = this.snapshotReader.getSidebarSnapshot()
    const reader = { getSidebarSnapshot: () => snapshot }
    const inputs = getSidebarCardInputs(reader, DIGIMON_CATALOG)
    const model = buildSidebarCardModel(inputs, DEFAULT_VPET_SETTINGS)
    const payload = toSidebarWebviewPayload(model)
    this.cachedPayload = payload
    await this.messengerSink.postModel(payload)

    if (this.presentationInProgress) return

    this.syncAnimationPartner(model)
    await this.postAnimationFrame()
  }

  private async resolvePendingBattleIfNeeded(): Promise<void> {
    if (this.presentationInProgress) return

    const snapshot = this.snapshotReader.getSidebarSnapshot()
    if (snapshot === null) return
    if (snapshot.pendingEvolutionTargetId === null || snapshot.battleOpponentNodeId === null) return

    this.presentationInProgress = true
    this.stopVisualInterval?.()
    delete this.stopVisualInterval
    this.cachedArtwork = ""

    try {
      await runEvolutionBattleSession(snapshot, this.artworkWidth, {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        repository: this.battleRepository,
        random: this.random,
        onArtwork: async (artwork) => this.postArtwork(artwork),
        onResolved: async (result) => {
          if (result.kind === "won") {
            this.pendingEvolutionReveal = undefined
            this.notification.showInformation("Victory! Your partner evolved!")
          } else if (result.kind === "lost") {
            this.notification.showInformation("Defeat! You lost all tokens for this stage.")
          }
        },
      })
    } finally {
      this.presentationInProgress = false
      if (this.view?.visible) this.startVisualInterval()
    }
  }

  private async playPendingEvolutionReveal(): Promise<void> {
    const evolution = this.pendingEvolutionReveal
    if (evolution === undefined || this.presentationInProgress) return

    this.pendingEvolutionReveal = undefined
    this.presentationInProgress = true
    this.stopVisualInterval?.()
    delete this.stopVisualInterval
    this.cachedArtwork = ""

    try {
      const revealed = await runEvolutionRevealSession(evolution, this.artworkWidth, {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        onArtwork: async (artwork) => this.postArtwork(artwork),
      })
      if (revealed) {
        this.notification.showInformation("Your partner evolved!")
      }
    } finally {
      this.presentationInProgress = false
      if (this.view?.visible) this.startVisualInterval()
    }
  }

  private async postArtwork(artwork: string): Promise<void> {
    this.cachedArtwork = artwork
    await this.messengerSink?.postArtwork(artwork)
  }

  private syncAnimationPartner(model: ReturnType<typeof buildSidebarCardModel>): void {
    this.animation.dispatch({
      kind: "partner_changed",
      partner: model.kind === "partner" ? { sprite: model.sprite, isDigitama: model.stageNumber === 0 } : undefined,
    })
  }

  private syncAnimationViewport(): void {
    this.animation.dispatch({ kind: "viewport_resized", width: this.artworkWidth })
  }

  private startVisualInterval(): void {
    if (this.stopVisualInterval !== undefined) return
    this.stopVisualInterval = this.scheduler.start(() => {
      if (this.view === undefined || !this.view.visible || this.presentationInProgress) return
      const nextAnimation = this.animation.dispatch({ kind: "tick" })
      void this.postAnimationFrame(nextAnimation)
    }, VISUAL_INTERVAL_MS)
  }

  private async postAnimationFrame(animation?: MonsterAnimationOutput): Promise<void> {
    if (this.view === undefined || this.presentationInProgress) return
    const output = animation ?? this.animation.output()
    const artwork = renderPositionedArtwork(output, this.artworkWidth)
    if (artwork === this.cachedArtwork) return
    this.cachedArtwork = artwork
    await this.messengerSink?.postArtwork(artwork)
  }
}
