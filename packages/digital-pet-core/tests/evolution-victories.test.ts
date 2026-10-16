import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import reference from "../src/data/evolution-reference.json" with { type: "json" }
import { applyTokenProgress, resolveEvolutionBattle, STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"
import { availableEvolutionTargets } from "../src/domain/evolution-options.ts"

const species = (id: string) => {
  const node = DIGIMON_CATALOG.byId.get(id)
  if (!node) throw new Error(`Missing species ${id}`)
  return node
}

test("reviewed routes unlock at the game's 3, 5, 7 and 10 victory thresholds", () => {
  for (const [sourceId, targetId, minimum] of [
    ["4-131", "5-006", 3],
    ["4-011", "5-098", 5],
    ["3-001", "7-041", 7],
    ["6-024", "7-004", 10],
  ] as const) {
    const current = species(sourceId)
    expect(availableEvolutionTargets(current, 0, minimum - 1)).not.toContain(targetId)
    expect(availableEvolutionTargets(current, 0, minimum)).toContain(targetId)
    expect(availableEvolutionTargets(current, 0, 200)).toContain(targetId)
  }
  expect(reference.requirements["4-131:5-006"]).toEqual([[7, 12, null]])
})

test("adapted alternatives preserve unrestricted care and the higher requirement for dirty care", () => {
  const growlmon = species("4-055")
  for (const care of [0, 1]) expect(availableEvolutionTargets(growlmon, care, 0)).toContain("5-135")
  expect(availableEvolutionTargets(growlmon, 2, 2)).not.toContain("5-135")
  expect(availableEvolutionTargets(growlmon, 2, 3)).toContain("5-135")
  expect(availableEvolutionTargets(growlmon, 3, 10)).not.toContain("5-135")
  const kuwagamon = species("4-066")
  expect(availableEvolutionTargets(kuwagamon, 0, 3)).toContain("5-101")
  expect(availableEvolutionTargets(kuwagamon, 3, 3)).not.toContain("5-101")
  expect(availableEvolutionTargets(kuwagamon, 3, 5)).toContain("5-101")
})

test("Turuiemon's third victory can unlock Antylamon in the evolution duel itself", () => {
  const current = species("4-131")
  const pending = applyTokenProgress(
    {
      current,
      gauge: 0,
      combatVictories: 2,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    },
    STAGE_GAUGE_THRESHOLDS[4],
    () => 0,
    DIGIMON_CATALOG.byId,
    DIGIMON_CATALOG.nodes,
    STAGE_GAUGE_THRESHOLDS,
  )
  expect(pending.combatVictories).toBe(2)
  const resolved = resolveEvolutionBattle(pending, true, DIGIMON_CATALOG.byId, 0, () => 0)
  expect(resolved.current.id).toBe("5-006")
  expect(resolved.combatVictories).toBe(0)
  expect(resolved.gauge).toBe(0)
})

test("the winning duel supplies the last required victory before choosing the evolution", () => {
  const original = species("3-001")
  const current = {
    ...original,
    nextEvolutions: ["7-041"],
    evolutionRoutes: original.evolutionRoutes?.filter((route) => route.targetId === "7-041") ?? [],
  }
  expect(availableEvolutionTargets(current, 0, 6)).toEqual([])
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
  const won = resolveEvolutionBattle({ ...pending, combatVictories: 6 }, true, DIGIMON_CATALOG.byId, 0, () => 0)
  expect(won.current.id).toBe("7-041")
  expect(won.gauge).toBe(0)
  expect(won.combatVictories).toBe(0)
  const notEnough = resolveEvolutionBattle({ ...pending, combatVictories: 5 }, true, DIGIMON_CATALOG.byId, 0, () => 0)
  expect(notEnough.current.id).toBe(current.id)
  expect(notEnough.combatVictories).toBe(6)
  expect(notEnough.gauge).toBe(0)
  const lost = resolveEvolutionBattle({ ...pending, combatVictories: 6 }, false, DIGIMON_CATALOG.byId)
  expect(lost.combatVictories).toBe(6)
  expect(lost.current.id).toBe(current.id)
  expect(lost.gauge).toBe(0)
})

test("care and victories remain in the same condition alternative", () => {
  const base = species("3-001")
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
