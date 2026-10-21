import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { applyTokenProgress, resolveEvolutionBattle, STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"
import { assertEvolutionBranch } from "../src/domain/evolution-battle.ts"
import { availableEvolutionTargets } from "../src/domain/evolution-options.ts"

const catalogNode = (id: string) => {
  const node = DIGIMON_CATALOG.byId.get(id)
  if (!node) throw new Error(`Missing catalog node ${id}`)
  return node
}

test("Lopmon can evolve to Turuiemon after winning with any current care count", () => {
  const current = DIGIMON_CATALOG.byId.get("3-047")
  if (!current) throw new Error("Missing Lopmon")
  const route = current.evolutionRoutes?.find((route) => route.targetId === "4-131")
  expect(route).toMatchObject({ kind: "normal", careMask: 15 })
  expect(route?.sources).toContain("pen20")
  for (const care of [0, 1, 2, 3]) {
    expect(availableEvolutionTargets(current, care)).toContain("4-131")
    const pending = applyTokenProgress(
      { current, gauge: 0, isTerminal: false, pendingEvolutionTargetId: null, battleOpponentNodeId: null },
      STAGE_GAUGE_THRESHOLDS[3],
      () => 0,
      DIGIMON_CATALOG.byId,
      DIGIMON_CATALOG.nodes,
      STAGE_GAUGE_THRESHOLDS,
      care,
    )
    expect(pending.battleOpponentNodeId).not.toBeNull()
    expect(resolveEvolutionBattle(pending, true, DIGIMON_CATALOG.byId, care, () => 0).current.id).toBe("4-131")
  }
})

test("reviewed identities keep existing IDs and restore missing alias branches", () => {
  expect(DIGIMON_CATALOG.nodes).toHaveLength(650)
  expect(DIGIMON_CATALOG.byId.get("5-033")).toMatchObject({
    nameEn: "DoneDevimon",
    nameJp: "DoneDevimon",
    stage: 6,
    url: "https://digimon.net/reference_en/detail.php?directory_name=donedevimon",
  })
  for (const [from, target, care] of [
    ["5-100", "5-033", 2],
    ["4-082", "5-065", 1],
    ["4-096", "5-023", 2],
    ["4-007", "5-023", 2],
    ["5-023", "6-120", 2],
  ] as const) {
    expect(availableEvolutionTargets(catalogNode(from), care, 10)).toContain(target)
  }
  expect(availableEvolutionTargets(catalogNode("4-082"), 2, 10)).not.toContain("5-065")
  expect(catalogNode("5-033").evolutionRoutes!.filter((r) => r.kind === "normal")).toEqual([])
})

test("named tag-battle partners cannot be bypassed through automatic EXP", () => {
  for (const [from, target] of [
    ["6-133", "7-014"],
    ["6-030", "7-014"],
    ["6-028", "7-033"],
    ["6-038", "7-033"],
    ["6-001", "7-039"],
    ["6-080", "7-039"],
    ["6-015", "7-018"],
    ["6-041", "7-018"],
  ] as const) {
    const current = catalogNode(from)
    expect(current.evolutionRoutes?.find((r) => r.targetId === target)?.kind).toBe("jogress")
    for (const care of [0, 1, 2, 3]) expect(availableEvolutionTargets(current, care, 1_000_000)).not.toContain(target)
  }
})

test("duplicate DORUguremon save IDs count once in the automatic selection pool", () => {
  for (const id of ["4-033", "4-109", "4-128"]) {
    const current = catalogNode(id)
    expect(current.nextEvolutions).toContain("5-146")
    const choices = availableEvolutionTargets(current, 0, 10)
    expect(choices).toContain("5-034")
    expect(choices).not.toContain("5-146")
  }
})

test("Turuiemon's Antylamon route keeps care and victories together", () => {
  const current = DIGIMON_CATALOG.byId.get("4-131")
  if (!current) throw new Error("Missing Turuiemon")
  for (const care of [0, 1, 2]) {
    expect(availableEvolutionTargets(current, care, 2)).not.toContain("5-006")
    expect(availableEvolutionTargets(current, care, 3)).toContain("5-006")
  }
  expect(availableEvolutionTargets(current, 3, 3)).not.toContain("5-006")
})

test("Angewomon's Pendulum Color fusions cannot become ordinary EXP evolutions", () => {
  const current = DIGIMON_CATALOG.byId.get("5-004")
  if (!current) throw new Error("Missing Angewomon")
  for (const targetId of ["6-066", "6-090"]) {
    const route = current.evolutionRoutes?.find((route) => route.targetId === targetId)
    expect(route?.kind).toBe("jogress")
    for (const care of [0, 1, 2, 3]) expect(availableEvolutionTargets(current, care, 1000)).not.toContain(targetId)
  }
})

test("verified EXP routes point forwards, retain provenance and agree with their condition masks", () => {
  for (const current of DIGIMON_CATALOG.nodes) {
    for (const route of current.evolutionRoutes ?? []) {
      const target = DIGIMON_CATALOG.byId.get(route.targetId)
      if (!target) throw new Error(`Missing evolution target ${route.targetId}`)
      if (route.kind !== "normal" || current.stage === 0) continue
      expect(target.stage).toBeGreaterThan(current.stage)
      expect(route.sources.length).toBeGreaterThan(0)
      expect(route.careMask).toBeGreaterThan(0)
      if (route.requirements) {
        expect(route.requirements.reduce((mask, alternative) => mask | alternative.careMask, 0)).toBe(route.careMask)
      }
    }
  }
})

test("the broader import restores missing baby, child, adult and perfect lines", () => {
  for (const id of ["1-005", "1-011", "1-027", "1-028", "2-035", "3-003", "4-013", "5-100"]) {
    const current = DIGIMON_CATALOG.byId.get(id)
    if (!current) throw new Error(`Missing species ${id}`)
    expect(current.evolutionRoutes?.some((route) => route.kind === "normal")).toBe(true)
  }
})

test("withdrawn inferred Gallantmon X branches stay addressable only for pending saves", () => {
  for (const id of ["6-099", "6-135"]) {
    const current = DIGIMON_CATALOG.byId.get(id)
    if (!current) throw new Error(`Missing species ${id}`)
    expect(current.evolutionRoutes?.find((route) => route.targetId === "7-016")?.kind).toBe("unverified")
    expect(() => assertEvolutionBranch(current, "7-016")).not.toThrow()
    for (const care of [0, 1, 2, 3]) expect(availableEvolutionTargets(current, care, 1000)).not.toContain("7-016")
  }
})
