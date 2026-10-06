import { describe, expect, mock, test } from "bun:test"

import type { ResolveEvolutionBattleOutcome } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { EvolutionBattleRepository } from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"

mock.module("../src/utils/sleep.ts", () => ({
  sleep: async () => {},
}))

import { runEvolutionBattleSession } from "../src/sessions/evolution-battle-session.ts"
import type { BattleFrameHud } from "../src/sequences/evolution-battle-artwork.ts"
import { battleSidebarSnapshot } from "./session-fixtures.ts"

const pendingBattleSnapshot = battleSidebarSnapshot()

const createRepository = (outcome: "won" | "lost"): EvolutionBattleRepository => ({
  getActivePartner: () => ({
    partnerId: "partner-1",
    generation: 1,
    currentNodeId: pendingBattleSnapshot.currentNodeId,
    gauge: pendingBattleSnapshot.gauge,
    isTerminal: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
    pendingEvolutionTargetId: pendingBattleSnapshot.pendingEvolutionTargetId,
    battleOpponentNodeId: pendingBattleSnapshot.battleOpponentNodeId,
  }),
  resolveEvolutionBattle: () =>
    outcome === "won" ? { kind: "won", evolution: { fromNodeId: "3-001", toNodeId: "4-017" } } : { kind: "lost" },
})

describe("evolution battle session", () => {
  test("legacy artwork-only consumers receive identical frames and outcomes to consumers of phase and HUD metadata", async () => {
    for (const outcome of ["won", "lost"] as const) {
      const legacyFrames: string[] = []
      const metadataFrames: string[] = []
      const results: ResolveEvolutionBattleOutcome[] = []
      let phase = "idle"
      const random = () => (outcome === "won" ? 0 : 0.99)
      const dependencies = {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        repository: createRepository(outcome),
        random,
        onResolved: async (result: ResolveEvolutionBattleOutcome) => {
          results.push(result)
        },
      }
      await runEvolutionBattleSession(pendingBattleSnapshot, 80, {
        ...dependencies,
        onArtwork: async (artwork) => {
          legacyFrames.push(artwork)
        },
      })
      await runEvolutionBattleSession(pendingBattleSnapshot, 80, {
        ...dependencies,
        onState: async (state) => {
          phase = state.phase
        },
        onArtwork: async (artwork, hud) => {
          metadataFrames.push(artwork)
          if (hud !== undefined) expect(phase).toBe("battle")
          if (phase !== "battle") expect(hud).toBeUndefined()
        },
      })
      expect(metadataFrames).toEqual(legacyFrames)
      expect(results[1]).toEqual(results[0])
    }
  })

  test("Given a snapshot without a pending battle When running the session Then it is a no-op", async () => {
    const frames: string[] = []
    const battled = await runEvolutionBattleSession(
      {
        currentNodeId: "0-001",
        gauge: 0,
        isTerminal: false,
        frozen: false,
        isSetOverride: false,
        trainerTotalTokens: 0,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      },
      80,
      {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        repository: {
          getActivePartner: () => null,
          resolveEvolutionBattle: () => ({ kind: "no_pending_battle" }),
        },
        onArtwork: async (artwork) => {
          frames.push(artwork)
        },
      },
    )

    expect(battled).toBeFalse()
    expect(frames).toEqual([])
  })

  test("Given a pending battle When the player wins Then it plays battle and reveal artwork and resolves won", async () => {
    const frames: string[] = []
    const huds: BattleFrameHud[] = []
    const phases: string[] = []
    let resolved: ResolveEvolutionBattleOutcome | undefined
    const battled = await runEvolutionBattleSession(pendingBattleSnapshot, 80, {
      frameCatalog: MONSTER_FRAME_CATALOG,
      digimonCatalog: DIGIMON_CATALOG,
      onState: async (state) => {
        phases.push(state.phase)
      },
      repository: createRepository("won"),
      random: () => 0,
      onArtwork: async (artwork, hud) => {
        frames.push(artwork)
        if (hud !== undefined) huds.push(hud)
      },
      onResolved: async (result) => {
        resolved = result
      },
    })

    expect(battled).toBeTrue()
    expect(frames.length).toBeGreaterThan(0)
    expect(phases).toEqual(["battle", "evolving", "evolved"])
    expect(huds[0]).toMatchObject({ playerHits: 0, opponentHits: 0, hitsToWin: 3, caption: null })
    expect(huds.some((hud) => hud.playerHits === 1 && hud.caption === "HIT!")).toBe(true)
    expect(huds.at(-1)).toMatchObject({ playerHits: 3, hitsToWin: 3, caption: "WIN!" })
    expect(huds.every((hud) => hud.playerHits <= 3 && hud.opponentHits <= 3)).toBe(true)
    expect(resolved).toEqual({ kind: "won", evolution: { fromNodeId: "3-001", toNodeId: "4-017" } })
  })

  test("Given a pending battle When the player loses Then it plays battle and defeat artwork and resolves lost", async () => {
    const frames: string[] = []
    const phases: string[] = []
    let resolved: ResolveEvolutionBattleOutcome | undefined
    const battled = await runEvolutionBattleSession(pendingBattleSnapshot, 80, {
      frameCatalog: MONSTER_FRAME_CATALOG,
      digimonCatalog: DIGIMON_CATALOG,
      onState: async (state) => {
        phases.push(state.phase)
      },
      repository: createRepository("lost"),
      random: () => 0.99,
      onArtwork: async (artwork) => {
        frames.push(artwork)
      },
      onResolved: async (result) => {
        resolved = result
      },
    })

    expect(battled).toBeTrue()
    expect(frames.length).toBeGreaterThan(0)
    expect(phases).toEqual(["battle", "defeated"])
    expect(resolved).toEqual({ kind: "lost" })
  })

  test("Given unknown catalog nodes When running the session Then it is a no-op", async () => {
    const frames: string[] = []
    const phases: string[] = []
    const battled = await runEvolutionBattleSession(
      {
        ...pendingBattleSnapshot,
        currentNodeId: "missing-partner",
        battleOpponentNodeId: "missing-opponent",
      },
      80,
      {
        frameCatalog: MONSTER_FRAME_CATALOG,
        digimonCatalog: DIGIMON_CATALOG,
        onState: async (state) => {
          phases.push(state.phase)
        },
        repository: createRepository("won"),
        onArtwork: async (artwork) => {
          frames.push(artwork)
        },
      },
    )

    expect(battled).toBeFalse()
    expect(frames).toEqual([])
    expect(phases).toEqual([])
  })
})
