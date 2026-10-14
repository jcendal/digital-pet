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
      expect(availableEvolutionTargets(garurumon, care)).toContain(next.pendingEvolutionTargetId!)
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
          chosen = progression.pendingEvolutionTargetId
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

test("a dirty companion with no eligible route retains full EXP and can evolve after cleaning", () => {
  const current = DIGIMON_CATALOG.byId.get("4-010")!
  const initial = { ...state, current }
  const waiting = applyTokenProgress(
    initial,
    STAGE_GAUGE_THRESHOLDS[4],
    () => 0,
    DIGIMON_CATALOG.byId,
    DIGIMON_CATALOG.nodes,
    STAGE_GAUGE_THRESHOLDS,
    3,
  )
  expect(waiting.isTerminal).toBe(false)
  expect(waiting.gauge).toBe(STAGE_GAUGE_THRESHOLDS[4])
  expect(waiting.pendingEvolutionTargetId).toBeNull()
  const cleaned = applyTokenProgress(
    waiting,
    0,
    () => 0,
    DIGIMON_CATALOG.byId,
    DIGIMON_CATALOG.nodes,
    STAGE_GAUGE_THRESHOLDS,
    2,
  )
  expect(availableEvolutionTargets(current, 2)).toContain(cleaned.pendingEvolutionTargetId!)
})

test("adventure loot applies the same care decision before opening an evolution battle", async () => {
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
    if (count === 3) {
      expect(mutation?.progression?.pendingEvolutionTargetId).toBeNull()
      expect(mutation?.progression?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[4])
      expect(mutation?.adventure.status).toBe("travel")
    } else {
      expect(availableEvolutionTargets(current, count)).toContain(mutation?.progression?.pendingEvolutionTargetId ?? "")
      expect(mutation?.adventure.status).toBe("evolved")
    }
  }
})
