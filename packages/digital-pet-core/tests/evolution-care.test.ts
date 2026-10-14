import { expect, test } from "bun:test"
import type { AdventureMutation } from "../src/application/ports/adventure-store.ts"
import { createAdventureService } from "../src/application/use-cases/explore-adventure.ts"
import { recordUsage } from "../src/application/use-cases/record-usage.ts"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { applyTokenProgress, resolveEvolutionBattle, STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"
import { availableEvolutionTargets } from "../src/domain/evolution-options.ts"

const garurumon = DIGIMON_CATALOG.byId.get("4-046")!
const state = {
  current: garurumon,
  gauge: 0,
  isTerminal: false,
  pendingEvolutionTargetId: null,
  battleOpponentNodeId: null,
}

test("Garurumon has a referenced Jogress route to Orochimon which EXP cannot select", () => {
  expect(garurumon.evolutionRoutes?.find((route) => route.targetId === "5-104")?.kind).toBe("jogress")
  for (const care of [0, 1, 2, 3]) {
    expect(availableEvolutionTargets(garurumon, care)).not.toContain("5-104")
    for (const selection of [0, 0.2, 0.5, 0.8, 0.999]) {
      const next = applyTokenProgress(
        state,
        STAGE_GAUGE_THRESHOLDS[4],
        () => selection,
        DIGIMON_CATALOG.byId,
        DIGIMON_CATALOG.nodes,
        STAGE_GAUGE_THRESHOLDS,
        care,
      )
      const resolved = resolveEvolutionBattle(next, true, DIGIMON_CATALOG.byId, care, () => selection)
      expect(availableEvolutionTargets(garurumon, care, 1)).toContain(resolved.current.id)
      expect(resolved.current.id).not.toBe("5-104")
    }
  }
})

test("unclean piles restrict WereGarurumon; cleaning before selection restores its route", () => {
  for (const care of [0, 1, 2]) expect(availableEvolutionTargets(garurumon, care)).toContain("5-139")
  expect(availableEvolutionTargets(garurumon, 3)).not.toContain("5-139")
  const agumon = DIGIMON_CATALOG.byId.get("3-001")!
  expect(availableEvolutionTargets(agumon, 0)).not.toContain("4-088")
  expect(availableEvolutionTargets(agumon, 3)).toContain("4-088")
})

test("Dracomon's missing Coredramon routes are restored with provenance", () => {
  const dracomon = DIGIMON_CATALOG.byId.get("3-016")!
  expect(availableEvolutionTargets(dracomon)).toContain("4-018")
  expect(availableEvolutionTargets(dracomon)).toContain("4-019")
  expect(dracomon.evolutionRoutes?.find((route) => route.targetId === "4-018")?.sources.length).toBeGreaterThan(0)
})

test("token receipts receive care from the ledger rather than assuming a clean companion", () => {
  for (const care of [0, 3]) {
    let chosen: string | null = null
    recordUsage({
      ledger: {
        applyUsageReceipt: (_receipt, evolve) => {
          const progression = evolve(
            {
              partnerId: "pet",
              generation: 1,
              currentNodeId: garurumon.id,
              gauge: 0,
              isTerminal: false,
              pendingEvolutionTargetId: null,
              battleOpponentNodeId: null,
              createdAt: "2026-10-14T00:00:00Z",
              retiredAt: null,
            },
            care,
          )
          const node = DIGIMON_CATALOG.byId.get(progression.currentNodeId)!
          chosen = resolveEvolutionBattle(
            {
              current: node,
              gauge: progression.gauge,
              isTerminal: progression.isTerminal,
              pendingEvolutionTargetId: progression.pendingEvolutionTargetId,
              battleOpponentNodeId: progression.battleOpponentNodeId,
            },
            true,
            DIGIMON_CATALOG.byId,
            care,
            () => 0.8,
          ).current.id
          return { kind: "applied" }
        },
      },
      usage: {
        receiptKey: `care-${care}`,
        eventId: `care-${care}`,
        tokenDelta: STAGE_GAUGE_THRESHOLDS[4],
        cost: null,
        createdAt: "2026-10-14T00:00:00Z",
      },
      digimonById: DIGIMON_CATALOG.byId,
      catalogNodes: DIGIMON_CATALOG.nodes,
      thresholds: STAGE_GAUGE_THRESHOLDS,
      selector: () => 0.8,
    })
    expect(availableEvolutionTargets(garurumon, care)).toContain(chosen!)
  }
})

test("legacy pending routes finish without rewriting companions or their history", () => {
  const resolved = resolveEvolutionBattle(
    { ...state, gauge: STAGE_GAUGE_THRESHOLDS[4], pendingEvolutionTargetId: "5-104", battleOpponentNodeId: "4-054" },
    true,
    DIGIMON_CATALOG.byId,
  )
  expect(resolved.current.id).toBe("5-104")
})

test("a dirty companion fights without a route, retains the win and loses EXP", () => {
  const current = DIGIMON_CATALOG.byId.get("4-010")!
  const pending = applyTokenProgress(
    { ...state, current },
    STAGE_GAUGE_THRESHOLDS[4],
    () => 0,
    DIGIMON_CATALOG.byId,
    DIGIMON_CATALOG.nodes,
    STAGE_GAUGE_THRESHOLDS,
    3,
  )
  expect(pending.pendingEvolutionTargetId).toBeNull()
  expect(pending.battleOpponentNodeId).not.toBeNull()
  const won = resolveEvolutionBattle(pending, true, DIGIMON_CATALOG.byId, 3)
  expect(won.current.id).toBe(current.id)
  expect(won.gauge).toBe(0)
  expect(won.combatVictories).toBe(1)
  const cleaned = applyTokenProgress(
    won,
    STAGE_GAUGE_THRESHOLDS[4],
    () => 0,
    DIGIMON_CATALOG.byId,
    DIGIMON_CATALOG.nodes,
    STAGE_GAUGE_THRESHOLDS,
    2,
  )
  const evolved = resolveEvolutionBattle(cleaned, true, DIGIMON_CATALOG.byId, 2, () => 0)
  expect(availableEvolutionTargets(current, 2, 2)).toContain(evolved.current.id)
})

test("adventure loot opens a duel and ends the trip even with no eligible route", async () => {
  const current = DIGIMON_CATALOG.byId.get("4-010")!
  for (const count of [2, 3]) {
    let mutation: AdventureMutation | undefined
    const service = createAdventureService(
      {
        nextReadyAt: () => 0,
        updateAdventure: (change) => {
          mutation = change({
            partner: {
              partnerId: "adventure-care",
              generation: 1,
              currentNodeId: current.id,
              gauge: STAGE_GAUGE_THRESHOLDS[4] * 0.98,
              isTerminal: false,
              pendingEvolutionTargetId: null,
              battleOpponentNodeId: null,
              createdAt: "2026-10-14T00:00:00Z",
              retiredAt: null,
            },
            adventure: {
              id: "trip",
              nodeId: current.id,
              regionId: "lake",
              running: true,
              elapsedMs: 1000,
              lastTickAt: 1000,
              nextEventAt: 5000,
              sequence: 1,
              collected: 0,
              victories: 0,
              status: "travel",
              event: { kind: "loot", item: "fragment", id: 1, appearedAt: 1000 },
            },
            hygiene: { poops: [100, 200, 300].slice(0, count), nextAt: count === 3 ? null : 5000, happyUntil: 0 },
            readyAt: 0,
            regionId: "lake",
            blocked: false,
            thresholds: STAGE_GAUGE_THRESHOLDS,
          })
          return mutation?.adventure
        },
      },
      DIGIMON_CATALOG,
      () => [],
      () => 0,
    )
    await service.act({ kind: "collect", adventureId: "trip", eventId: 1 }, 1000)
    expect(mutation?.progression?.pendingEvolutionTargetId).toBeNull()
    expect(mutation?.progression?.battleOpponentNodeId).not.toBeNull()
    expect(mutation?.progression?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[4])
    expect(mutation?.adventure.status).toBe("evolved")
  }
})
