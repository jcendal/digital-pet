import { runAdventureBattleSession } from "@jcendal/digital-pet-animation/sessions/adventure-battle-session.ts"
import { runEvolutionBattleSession } from "@jcendal/digital-pet-animation/sessions/evolution-battle-session.ts"
import { runEvolutionRevealSession } from "@jcendal/digital-pet-animation/sessions/evolution-reveal-session.ts"
import type { PresentationState } from "@jcendal/digital-pet-animation/sessions/presentation-state.ts"
import type { UsageEvolutionTransition } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import type { AdventureService } from "@jcendal/digital-pet-core/application/use-cases/explore-adventure.ts"
import type { EvolutionBattleRepository } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"
import { adventureBusy } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { HygieneView } from "@jcendal/digital-pet-core/domain/hygiene.ts"
import type { AnimationSink } from "../../adapters/vscode/animation-sink.ts"
import type { NotificationPort } from "../../adapters/vscode/notification-port.ts"
import { IntlModule } from "../../i18n.ts"
import { createAsyncRefreshQueue } from "../../shared/async-refresh-queue.ts"
import type { SidebarAnimationHost } from "./sidebar-animation-host.ts"
import { buildSidebarPresentation } from "./sidebar-presenter.ts"
import type { EggPettingView, SidebarWebviewPayload } from "./webview-messages.ts"

export type SidebarOrchestrator = {
  playAdventureBattle(adventure: AdventureState, service: AdventureService, active: () => boolean): Promise<void>
  refresh(): Promise<void>
  queueEvolutionReveal(evolution: UsageEvolutionTransition): void
  isPresentationInProgress(): boolean
  getCachedPayload(): SidebarWebviewPayload | undefined
  setSink(sink: AnimationSink): void
}

export type CreateSidebarOrchestratorOptions = {
  readonly snapshotReader: SidebarSnapshotReader
  readonly battleRepository: EvolutionBattleRepository
  readonly animationHost: SidebarAnimationHost
  readonly notification: NotificationPort
  readonly random?: () => number
  readonly onPresentationEnd?: () => void
  readonly readHygiene?: () => HygieneView | undefined
  readonly readEgg?: () => EggPettingView | undefined
  readonly readAdventure?: () => AdventureState | undefined
}

export const createSidebarOrchestrator = ({
  snapshotReader,
  battleRepository,
  animationHost,
  notification,
  random = Math.random,
  onPresentationEnd,
  readHygiene,
  readEgg,
  readAdventure,
}: CreateSidebarOrchestratorOptions): SidebarOrchestrator => {
  const refreshQueue = createAsyncRefreshQueue()
  let sink: AnimationSink | undefined
  let cachedPayload: SidebarWebviewPayload | undefined
  let pendingEvolutionReveal: UsageEvolutionTransition | undefined
  let presentationInProgress = false
  let currentState: PresentationState = { phase: "idle" }
  const publishState = async (state: PresentationState): Promise<void> => {
    currentState = state
    if (state.phase !== "idle") {
      const snapshot = snapshotReader.getSidebarSnapshot()
      if (snapshot !== null && sink !== undefined) {
        const currentNodeId = state.phase === "evolved" ? state.toNodeId : state.fromNodeId
        cachedPayload = buildSidebarPresentation({ ...snapshot, currentNodeId }).payload
        if (state.phase === "battle" && cachedPayload.kind === "partner") {
          cachedPayload = {
            ...cachedPayload,
            opponentName: DIGIMON_CATALOG.byId.get(state.opponentNodeId)?.nameEn ?? "",
          }
        }
        await sink.postModel(cachedPayload)
      }
    }
    await sink?.postState?.(state)
  }

  const publishSidebarModel = async (): Promise<void> => {
    if (sink === undefined) return
    const presentation = buildSidebarPresentation(snapshotReader.getSidebarSnapshot())
    const hygiene = readHygiene?.()
    const egg = readEgg?.()
    const adventure = readAdventure?.()
    const canCare = !adventureBusy(adventure)
    cachedPayload =
      presentation.payload.kind === "partner"
        ? {
            ...presentation.payload,
            canPet: Boolean(presentation.payload.canPet && canCare),
            ...(hygiene ? { hygiene } : {}),
            ...(egg ? { egg } : {}),
          }
        : presentation.payload
    if (!presentationInProgress) {
      animationHost.syncPartner(presentation.partner)
      animationHost.setMood(hygiene?.mood ?? "neutral")
    }
    await sink.postModel(cachedPayload)
    if (presentationInProgress) return
    await animationHost.postCurrentFrame()
  }

  const resolvePendingBattleIfNeeded = async (): Promise<void> => {
    if (presentationInProgress) return
    const snapshot = snapshotReader.getSidebarSnapshot()
    if (snapshot === null) return
    if (snapshot.pendingEvolutionTargetId === null || snapshot.battleOpponentNodeId === null) return

    presentationInProgress = true
    animationHost.setPresentationBlocked(true)
    animationHost.stop()
    animationHost.clearArtwork()

    try {
      await runEvolutionBattleSession(snapshot, animationHost.getArtworkWidth(), {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        repository: battleRepository,
        random,
        onState: publishState,
        onArtwork: async (artwork, hud) => {
          if (sink !== undefined) await sink.postArtwork(artwork, hud)
        },
        onResolved: async (result) => {
          if (result.kind === "won") {
            pendingEvolutionReveal = undefined
            notification.showInformation(IntlModule.translate("sidebarOrchestrator.victoryYourPartnerEvolved"))
          } else if (result.kind === "lost") {
            notification.showInformation(IntlModule.translate("sidebarOrchestrator.defeatYouLostAllTokensForThisStage"))
          }
        },
      })
    } finally {
      presentationInProgress = false
      await publishState({ phase: "idle" })
      animationHost.setPresentationBlocked(false)
      onPresentationEnd?.()
    }
  }

  const playPendingEvolutionReveal = async (): Promise<void> => {
    const evolution = pendingEvolutionReveal
    if (evolution === undefined || presentationInProgress) return

    pendingEvolutionReveal = undefined
    presentationInProgress = true
    animationHost.setPresentationBlocked(true)
    animationHost.stop()
    animationHost.clearArtwork()

    try {
      const revealed = await runEvolutionRevealSession(evolution, animationHost.getArtworkWidth(), {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        onState: publishState,
        onArtwork: async (artwork) => {
          if (sink !== undefined) await sink.postArtwork(artwork)
        },
      })
      if (revealed) {
        notification.showInformation(IntlModule.translate("sidebarOrchestrator.yourPartnerEvolved"))
      }
    } finally {
      presentationInProgress = false
      await publishState({ phase: "idle" })
      animationHost.setPresentationBlocked(false)
      onPresentationEnd?.()
    }
  }

  return {
    async playAdventureBattle(adventure, service, active) {
      if (presentationInProgress) return
      presentationInProgress = true
      animationHost.setPresentationBlocked(true)
      animationHost.stop()
      animationHost.clearArtwork()
      try {
        await runAdventureBattleSession(adventure, animationHost.getArtworkWidth(), {
          frames: MONSTER_FRAME_CATALOG,
          catalog: DIGIMON_CATALOG,
          active,
          onState: publishState,
          onFrame: async (artwork, hud) => {
            await sink?.postArtwork(artwork, hud)
          },
          checkpoint: async (eventId, completedShots) => {
            const next = await service.act(
              { kind: "checkpoint", eventId, completedShots, adventureId: adventure.id },
              Date.now(),
            )
            return (
              next?.id === adventure.id && next.event?.kind === "battle" && next.event.completedShots === completedShots
            )
          },
          finish: async (eventId) => {
            await service.act({ kind: "finish-battle", eventId, adventureId: adventure.id }, Date.now())
          },
        })
      } finally {
        presentationInProgress = false
        await publishState({ phase: "idle" })
        animationHost.setPresentationBlocked(false)
        onPresentationEnd?.()
      }
    },
    async refresh(): Promise<void> {
      if (presentationInProgress) return
      await refreshQueue.run(async () => {
        await resolvePendingBattleIfNeeded()
        await playPendingEvolutionReveal()
        await publishSidebarModel()
      })
    },
    queueEvolutionReveal(evolution: UsageEvolutionTransition): void {
      pendingEvolutionReveal = evolution
    },
    isPresentationInProgress(): boolean {
      return presentationInProgress
    },
    getCachedPayload(): SidebarWebviewPayload | undefined {
      return cachedPayload
    },
    setSink(nextSink: AnimationSink): void {
      sink = nextSink
      void sink.postState?.(currentState)
    },
  }
}
