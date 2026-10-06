import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"

import type { SidebarCardModel } from "@jcendal/digital-pet-core/view-models/sidebar-view-model.ts"
import { MONSTER_FRAME_CATALOG } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import {
  buildBattleScoreRow,
  defaultBattleScene,
  renderEvolutionBattleArtwork,
} from "@jcendal/digital-pet-animation/sequences/evolution-battle-artwork.ts"
import type { PresentationState } from "@jcendal/digital-pet-animation/sessions/presentation-state.ts"
import { DigitalPetSidebarCard } from "../src/tui/sidebar-card.tsx"

const partner: SidebarCardModel = {
  kind: "partner",
  name: "Agumon",
  sprite: "agumon",
  stage: "Child",
  stageNumber: 3,
  url: "https://example.test/agumon",
  gauge: 50,
  threshold: 100,
  isTerminal: false,
  frozen: false,
  isSetOverride: false,
  evolutionBattlePending: false,
}

const battleFrame = renderEvolutionBattleArtwork(
  MONSTER_FRAME_CATALOG,
  "agumon",
  "gabumon",
  defaultBattleScene({ playerHits: 1, lastResult: "hit" }),
  80,
)

describe("OpenCode sidebar presentation", () => {
  test("shared phases retain terminal score text and return to the normal gauge after presentation", async () => {
    const [phase, setPhase] = createSignal<PresentationState>({ phase: "idle" })
    const [artwork, setArtwork] = createSignal<string | undefined>()
    const [model, setModel] = createSignal(partner)
    const setup = await testRender(
      () =>
        DigitalPetSidebarCard({
          model,
          presentationState: phase,
          customArtwork: artwork,
          animation: () => ({ kind: "blank" }),
        }),
      { width: 80, height: 24 },
    )
    try {
      await setup.flush()
      const idle = setup.captureCharFrame()
      expect(idle).toContain("Next check: [")
      expect(idle).toContain("50/100")
      expect(idle).toContain("Encyclopedia entry")

      setPhase({ phase: "battle", fromNodeId: "3-001", opponentNodeId: "3-051" })
      setArtwork(battleFrame)
      await setup.renderOnce()
      const battle = setup.captureCharFrame()
      expect(battle).toContain("BATTLE")
      expect(battle).toContain(buildBattleScoreRow(1, 0))
      expect(battle).toContain("HIT!")
      for (const row of battleFrame.split("\n")) expect(battle).toContain(row.trimEnd())

      for (const state of [
        { phase: "evolving", fromNodeId: "3-001", toNodeId: "4-017" },
        { phase: "evolved", fromNodeId: "3-001", toNodeId: "4-017" },
        { phase: "defeated", fromNodeId: "3-001" },
      ] as const) {
        setPhase(state)
        if (state.phase === "evolved")
          setModel({ ...partner, name: "Greymon", sprite: "greymon", stage: "Adult", stageNumber: 4 })
        await setup.renderOnce()
        expect(setup.captureCharFrame()).toContain(state.phase.toUpperCase())
        if (state.phase === "evolved") expect(setup.captureCharFrame()).toContain("Greymon")
      }
      setPhase({ phase: "idle" })
      setArtwork(undefined)
      await setup.renderOnce()
      expect(setup.captureCharFrame()).toContain("Next check: [")
      expect(setup.captureCharFrame()).not.toContain("HIT!")
      expect(setup.captureCharFrame()).not.toContain("DEFEATED")
    } finally {
      setup.renderer.destroy()
    }
  })

  test("legacy consumers without a phase accessor keep their normal terminal layout", async () => {
    const setup = await testRender(
      () =>
        DigitalPetSidebarCard({
          model: () => partner,
          animation: () => ({ kind: "blank" }),
        }),
      { width: 80, height: 24 },
    )
    try {
      await setup.flush()
      const frame = setup.captureCharFrame()
      expect(frame).toContain("Agumon")
      expect(frame).toContain("Child")
      expect(frame).toContain("Next check: [")
      expect(frame).toContain("50/100")
    } finally {
      setup.renderer.destroy()
    }
  })
})
