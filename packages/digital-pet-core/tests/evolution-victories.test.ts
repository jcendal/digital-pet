import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { applyTokenProgress, resolveEvolutionBattle, STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"
import { availableEvolutionTargets } from "../src/domain/evolution-options.ts"

test("the winning duel supplies the last required victory before choosing the evolution", () => {
  const original = DIGIMON_CATALOG.byId.get("3-001")!
  const current = {
    ...original,
    nextEvolutions: ["7-041"],
    evolutionRoutes: original.evolutionRoutes?.filter((route) => route.targetId === "7-041") ?? [],
  }
  expect(availableEvolutionTargets(current, 0, 49)).toEqual([])
  const pending = applyTokenProgress(
    { current, gauge: 0, isTerminal: false, pendingEvolutionTargetId: null, battleOpponentNodeId: null },
    STAGE_GAUGE_THRESHOLDS[3],
    () => 0,
    DIGIMON_CATALOG.byId,
    DIGIMON_CATALOG.nodes,
    STAGE_GAUGE_THRESHOLDS,
  )
  expect(pending.pendingEvolutionTargetId).toBeNull()
  expect(pending.battleOpponentNodeId).not.toBeNull()
  const won = resolveEvolutionBattle({ ...pending, combatVictories: 49 }, true, DIGIMON_CATALOG.byId, 0, () => 0)
  expect(won.current.id).toBe("7-041")
  expect(won.gauge).toBe(0)
  expect(won.combatVictories).toBe(0)
  const notEnough = resolveEvolutionBattle({ ...pending, combatVictories: 48 }, true, DIGIMON_CATALOG.byId, 0, () => 0)
  expect(notEnough.current.id).toBe(current.id)
  expect(notEnough.combatVictories).toBe(49)
  expect(notEnough.gauge).toBe(0)
  const lost = resolveEvolutionBattle({ ...pending, combatVictories: 49 }, false, DIGIMON_CATALOG.byId)
  expect(lost.combatVictories).toBe(49)
  expect(lost.current.id).toBe(current.id)
  expect(lost.gauge).toBe(0)
})

test("care and victories remain in the same condition alternative", () => {
  const base = DIGIMON_CATALOG.byId.get("3-001")!
  const current = {
    ...base,
    evolutionRoutes: [
      {
        targetId: "4-054",
        kind: "normal" as const,
        careMask: 15,
        sources: [],
        requirements: [
          { careMask: 1, minVictories: 5, maxVictories: null },
          { careMask: 8, minVictories: 0, maxVictories: 2 },
        ],
      },
    ],
  }
  expect(availableEvolutionTargets(current, 0, 4)).toEqual([])
  expect(availableEvolutionTargets(current, 0, 5)).toEqual(["4-054"])
  expect(availableEvolutionTargets(current, 3, 2)).toEqual(["4-054"])
  expect(availableEvolutionTargets(current, 3, 5)).toEqual([])
  expect(availableEvolutionTargets(current, 1, 5)).toEqual([])
})
