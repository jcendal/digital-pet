import { expect, test } from "bun:test"
import { resolveEvolutionBattleForPartner } from "../src/application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import type { Partner } from "../src/domain/partner.ts"

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
  ]) {
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
