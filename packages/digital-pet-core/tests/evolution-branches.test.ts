import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { resolveEvolutionBattle } from "../src/domain/evolution.ts"
import { assertEvolutionBranch, pickEvolutionTarget } from "../src/domain/evolution-battle.ts"
import { availableEvolutionTargets } from "../src/domain/evolution-options.ts"

test("the historical graph remains addressable from the egg for existing saves", () => {
  const reached = new Set(["0-001"])
  const queue = ["0-001"]
  while (queue.length) {
    const node = DIGIMON_CATALOG.byId.get(queue.pop()!)!
    for (const target of node.nextEvolutions) {
      expect(DIGIMON_CATALOG.byId.has(target)).toBe(true)
      assertEvolutionBranch(node, target)
      if (!reached.has(target)) {
        reached.add(target)
        queue.push(target)
      }
    }
    for (const care of [0, 1, 2, 3]) {
      const available = availableEvolutionTargets(node, care)
      if (available.length)
        for (const selector of [0, 0.25, 0.5, 0.999999])
          expect(available).toContain(pickEvolutionTarget(node, () => selector, care))
    }
  }
  expect(reached.size).toBe(650)
})

test("battle resolution rejects an existing species outside the partner's branches on wins and losses", () => {
  const current = DIGIMON_CATALOG.byId.get("3-001")!
  const invalidTarget = DIGIMON_CATALOG.nodes.find(
    (node) => node.stage === 4 && !current.nextEvolutions.includes(node.id),
  )!
  const pending = {
    current,
    gauge: 40_000_000,
    isTerminal: false,
    pendingEvolutionTargetId: invalidTarget.id,
    battleOpponentNodeId: "3-022",
  }
  for (const won of [true, false])
    expect(() => resolveEvolutionBattle(pending, won, DIGIMON_CATALOG.byId)).toThrow("outside its branches")
  expect(() =>
    resolveEvolutionBattle(
      { ...pending, pendingEvolutionTargetId: current.nextEvolutions[0]!, battleOpponentNodeId: "7-001" },
      true,
      DIGIMON_CATALOG.byId,
    ),
  ).toThrow("opponent")
})
