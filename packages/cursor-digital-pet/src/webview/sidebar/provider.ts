import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import type { PartnerHygieneService } from "@jcendal/digital-pet-core/application/use-cases/care-for-partner.ts"
import type { AdventureService } from "@jcendal/digital-pet-core/application/use-cases/explore-adventure.ts"
import type { EggPettingService } from "@jcendal/digital-pet-core/application/use-cases/pet-egg.ts"
import type { EvolutionBattleRepository } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { AdventureCommand, AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"
import { adventureBusy } from "@jcendal/digital-pet-core/domain/adventure.ts"
import { CLEANING_HAPPY_MS, type HygieneView, hygieneMood } from "@jcendal/digital-pet-core/domain/hygiene.ts"
import { DEFAULT_WORLD_VISIT } from "@jcendal/digital-pet-fields/application/world.ts"
import { adventureView } from "@jcendal/digital-pet-webviews/sidebar/adventure-view.ts"
import * as vscode from "vscode"

import { type AnimationSink, createAnimationSink } from "../../adapters/vscode/animation-sink.ts"
import { createVsCodeNotificationPort, type NotificationPort } from "../../adapters/vscode/notification-port.ts"
import { createIntervalScheduler, type IntervalScheduler } from "../../adapters/vscode/scheduler.ts"
import { createWebviewMessenger } from "../../adapters/vscode/webview-messenger.ts"
import { createSidebarAnimationHost, type SidebarAnimationHost } from "./sidebar-animation-host.ts"
import { createSidebarOrchestrator, type SidebarOrchestrator } from "./sidebar-orchestrator.ts"
import { buildSidebarWebviewHtml } from "./sidebar-render.ts"
import { type EggPettingView, parseWebviewInboundMessage } from "./webview-messages.ts"

export type DigitalPetSidebarProviderOptions = {
  readonly adventureService?: AdventureService
  readonly notification?: NotificationPort
  readonly scheduler?: IntervalScheduler
  readonly random?: () => number
  readonly nowMs?: () => number
  readonly hygieneService?: PartnerHygieneService
  readonly eggPettingService?: EggPettingService
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
  private adventure: AdventureState | undefined
  private adventurePlaying = false
  private adventureReady = false
  private happyTimer: ReturnType<typeof setTimeout> | undefined
  private hygieneView: HygieneView | undefined
  private eggView: EggPettingView | undefined

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
      readEgg: () => this.eggView,
      readAdventure: () => this.adventure,
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
    if (this.orchestrator.isPresentationInProgress() || this.adventureBusy()) return
    this.animationHost.playFeedAnimation()
  }

  private adventureBusy(): boolean {
    return adventureBusy(this.adventure)
  }

  private async actAdventure(command: AdventureCommand): Promise<void> {
    const service = this.options.adventureService
    if (!service || !this.view) return
    if (command.kind !== "pause" && (!this.view.visible || this.isPresentationInProgress())) return
    await service.act(command, Date.now())
    this.adventure = await service.act({ kind: "read" }, Date.now())
    this.animationHost.setAdventure(
      Boolean(this.adventure?.running && this.adventure.status === "travel" && this.adventure.event?.kind !== "battle"),
    )
    await this.publishAdventure()
    if (this.adventure?.running && this.adventure.event?.kind === "battle" && !this.adventurePlaying) {
      const saved = this.adventure
      this.adventurePlaying = true
      try {
        await this.orchestrator.playAdventureBattle(
          saved,
          service,
          () => this.view?.visible === true && this.adventure?.running === true && this.adventure.id === saved.id,
        )
      } finally {
        this.adventurePlaying = false
        this.adventure = await service.act({ kind: "read" }, Date.now())
        await this.refresh()
      }
    } else if (command.kind !== "tick") await this.refresh()
  }

  private async publishAdventure(): Promise<void> {
    if (!this.options.adventureService || !this.view) return
    const snapshot = this.snapshotReader.getSidebarSnapshot()
    const node = snapshot && DIGIMON_CATALOG.byId.get(snapshot.currentNodeId)
    const available = Boolean(
      node?.stage && !snapshot?.frozen && !snapshot?.isSetOverride && !snapshot?.pendingEvolutionTargetId,
    )
    await this.view.webview.postMessage({
      type: "adventure-state",
      view: adventureView(
        available,
        this.adventure,
        DIGIMON_CATALOG,
        await this.options.adventureService.nextReadyAt(),
      ),
    })
  }

  async refresh(): Promise<void> {
    if (this.options.adventureService && !this.adventurePlaying) {
      if (!this.adventureReady) {
        await this.options.adventureService.act({ kind: "pause" }, Date.now())
        this.adventureReady = true
      }
      this.adventure = await this.options.adventureService.act({ kind: "read" }, Date.now())
      this.animationHost.setAdventure(
        Boolean(
          this.adventure?.running && this.adventure.status === "travel" && this.adventure.event?.kind !== "battle",
        ),
      )
      await this.publishAdventure()
    }
    const saved = this.options.hygieneService?.refreshHygiene(Date.now())
    const snapshot =
      this.options.hygieneService || this.options.eggPettingService
        ? this.snapshotReader.getSidebarSnapshot()
        : undefined
    this.eggView =
      this.options.eggPettingService &&
      snapshot?.partnerId &&
      DIGIMON_CATALOG.byId.get(snapshot.currentNodeId)?.stage === 0
        ? {
            partnerId: snapshot.partnerId,
            canPet:
              !snapshot.frozen &&
              !snapshot.isSetOverride &&
              !snapshot.isTerminal &&
              !snapshot.pendingEvolutionTargetId &&
              !this.isPresentationInProgress(),
          }
        : undefined
    this.hygieneView = saved
      ? {
          partnerId: saved.partnerId,
          poops: saved.hygiene.poops,
          mood: hygieneMood(saved.hygiene, Date.now()),
          canClean:
            !this.isPresentationInProgress() &&
            !this.adventureBusy() &&
            !snapshot?.frozen &&
            !snapshot?.pendingEvolutionTargetId,
        }
      : undefined
    await this.orchestrator.refresh()
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.adventureReady = false
    this.view = webviewView
    const messenger = createWebviewMessenger(webviewView.webview)
    const sink = createAnimationSink(messenger)
    this.deferredSink.setSink(sink)
    this.orchestrator.setSink(sink)

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist", "assets")],
    }

    webviewView.webview.html = buildSidebarWebviewHtml(String(Date.now()), {
      adventureSceneUri: webviewView.webview
        .asWebviewUri(
          vscode.Uri.joinPath(
            this.extensionUri,
            "dist",
            "assets",
            "regions",
            DEFAULT_WORLD_VISIT.locationId,
            "scene.svg",
          ),
        )
        .toString(),
      fontUri: webviewView.webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "assets", "fonts", "Silkscreen-Regular.ttf"))
        .toString(),
      cspSource: webviewView.webview.cspSource,
    })

    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      const inbound = parseWebviewInboundMessage(message)
      if (inbound === null) return
      if (inbound.type === "adventure") {
        void this.actAdventure(inbound.command).catch((error: unknown) =>
          this.notification.showInformation(String(error)),
        )
        return
      }
      if (inbound.type === "pet-partner") {
        const reaction =
          this.isPresentationInProgress() || this.adventureBusy() ? undefined : this.animationHost.petPartner()
        void messenger.post({
          type: "partner-petted",
          interactionId: inbound.interactionId,
          ...(reaction ? { reaction } : {}),
        })
        return
      }
      if (inbound.type === "pet-egg") {
        let accepted = false
        try {
          if (webviewView.visible && !this.isPresentationInProgress()) {
            const result = this.options.eggPettingService?.petEgg(inbound.partnerId, inbound.interactionId, Date.now())
            accepted = result?.accepted === true
            if (result?.accepted && result.evolution) this.queueEvolutionReveal(result.evolution)
          }
        } finally {
          void messenger.post({ type: "egg-petted", interactionId: inbound.interactionId, accepted })
          void this.refresh()
        }
        return
      }
      if (inbound.type === "clean-poop") {
        if (!this.isPresentationInProgress() && !this.adventureBusy())
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
        void this.actAdventure({ kind: "pause" })
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
