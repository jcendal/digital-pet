import { expect, test } from "bun:test"
import { resolveEvolutionBattleForPartner } from "../src/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { applyTokenProgress, resolveEvolutionBattle, STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"
import type { Partner } from "../src/domain/partner.ts"

const catalogNode = (id: string) => {
  const node = DIGIMON_CATALOG.byId.get(id)
  if (!node) throw new Error(`Missing catalog node ${id}`)
  return node
}

test("forms without outgoing connections still duel, retain wins, reset EXP and remain active", () => {
  for (const id of ["4-133", "5-129", "7-011"]) {
    const current = catalogNode(id)
    expect(current.nextEvolutions).toEqual([])
    const pending = applyTokenProgress(
      {
        current,
        gauge: 0,
        isTerminal: false,
        combatVictories: 2,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      },
      STAGE_GAUGE_THRESHOLDS[current.stage],
      () => 0,
      DIGIMON_CATALOG.byId,
      DIGIMON_CATALOG.nodes,
      STAGE_GAUGE_THRESHOLDS,
    )
    expect(pending.battleOpponentNodeId).not.toBeNull()
    const won = resolveEvolutionBattle(pending, true, DIGIMON_CATALOG.byId)
    expect(won).toMatchObject({ current, gauge: 0, isTerminal: false, combatVictories: 3, battleOpponentNodeId: null })
    expect(resolveEvolutionBattle(pending, false, DIGIMON_CATALOG.byId)).toMatchObject({
      current,
      gauge: 0,
      isTerminal: false,
      combatVictories: 2,
    })
    expect(
      applyTokenProgress(won, 100, () => 0, DIGIMON_CATALOG.byId, DIGIMON_CATALOG.nodes, STAGE_GAUGE_THRESHOLDS).gauge,
    ).toBe(100)
  }
})

test("already pending DoneDevimon duels survive its corrected stage in either battle position", () => {
  for (const [id, opponent, target] of [
    ["5-033", "5-001", "6-028"],
    ["5-100", "5-033", "5-033"],
  ] as const) {
    const pending = {
      current: catalogNode(id),
      gauge: 125_000_000,
      isTerminal: false,
      pendingEvolutionTargetId: target,
      battleOpponentNodeId: opponent,
    }
    expect(resolveEvolutionBattle(pending, true, DIGIMON_CATALOG.byId).current.id).toBe(target)
    expect(resolveEvolutionBattle(pending, false, DIGIMON_CATALOG.byId).current.id).toBe(id)
    expect(() =>
      resolveEvolutionBattle({ ...pending, battleOpponentNodeId: "4-001" }, true, DIGIMON_CATALOG.byId),
    ).toThrow("opponent")
  }
})

test("a completed animation cannot resolve a new partner or a different pending battle", () => {
  const expected: Partner = {
    partnerId: "original",
    generation: 1,
    currentNodeId: "3-001",
    gauge: 40_000_000,
    isTerminal: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
    pendingEvolutionTargetId: "4-017",
    battleOpponentNodeId: "3-022",
  }
  let writes = 0
  for (const changed of [
    { partnerId: "replacement" },
    { currentNodeId: "3-022" },
    { pendingEvolutionTargetId: "4-054" },
    { battleOpponentNodeId: "3-051" },
  ] as const) {
    const outcome = resolveEvolutionBattleForPartner(
      {
        getActivePartner: () => ({ ...expected, ...changed }),
        resolveEvolutionBattle: () => {
          writes++
          return { kind: "lost" }
        },
      },
      true,
      DIGIMON_CATALOG.byId,
      expected.createdAt,
      expected,
    )
    expect(outcome.kind).toBe("no_pending_battle")
  }
  expect(writes).toBe(0)
})
