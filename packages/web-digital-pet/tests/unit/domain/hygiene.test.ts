import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { availableEvolutionTargets } from "@jcendal/digital-pet-core/domain/evolution-options.ts"
import {
  advanceLocalPet,
  beginNewPartner,
  cleanLocalPoop,
  experienceThresholds,
  type LocalPetState,
} from "../../../src/domain/pet/progress.ts"
import { parsePetTransfer } from "../../../src/domain/transfer/protocol.ts"

const NOW = Date.now()
const state: LocalPetState = {
  partnerId: "partner",
  createdAt: new Date(NOW).toISOString(),
  currentNodeId: "3-001",
  gauge: 0,
  isTerminal: false,
  lastTickAt: NOW,
  experienceLevel: "low",
  events: [{ currentNodeId: "3-001", createdAt: new Date(NOW).toISOString() }],
  hygiene: { poops: [NOW - 26 * 3_600_000, NOW - 18 * 3_600_000, NOW - 2 * 3_600_000], nextAt: null, happyUntil: 0 },
}
test("web cleaning gives 5% of the selected level once, with a happy reaction", () => {
  const id = state.hygiene?.poops[0]
  if (id === undefined) throw new Error("No pile")
  const cleaned = cleanLocalPoop(state, state.partnerId, id, NOW)
  expect(cleaned.gauge).toBe(experienceThresholds("low")[3] * 0.05)
  expect(cleaned.hygiene?.poops).toHaveLength(2)
  expect(cleaned.hygiene?.happyUntil).toBe(NOW + 3_000)
  expect(cleanLocalPoop(cleaned, state.partnerId, id, NOW)).toBe(cleaned)
  expect(cleanLocalPoop(state, "old-partner", id, NOW)).toBe(state)
  expect(parsePetTransfer({ version: 1, state: cleaned }).state.hygiene).toEqual(cleaned.hygiene)
})
test("cleaning at 95% queues normal evolution; a new egg discards the old hygiene", () => {
  const id = state.hygiene?.poops[0]
  if (id === undefined) throw new Error("No pile")
  const ready = cleanLocalPoop({ ...state, gauge: experienceThresholds("low")[3] * 0.95 }, state.partnerId, id, NOW)
  expect(ready.pendingEvolution).toBeDefined()
  expect(cleanLocalPoop(ready, state.partnerId, id, NOW)).toBe(ready)
  const egg = beginNewPartner(state, "egg", NOW)
  expect(egg.hygiene).toBeUndefined()
  expect(advanceLocalPet(egg, NOW).hygiene).toBeUndefined()
})

test("full EXP waits with three piles and cleaning chooses a route using the remaining two", () => {
  const dirty = { ...state, currentNodeId: "4-010", gauge: experienceThresholds("low")[4] }
  const waiting = advanceLocalPet(dirty, NOW, () => 0)
  expect(waiting.pendingEvolution).toBeUndefined()
  expect(waiting.isTerminal).toBe(false)
  expect(waiting.gauge).toBe(dirty.gauge)
  const id = dirty.hygiene?.poops[0]
  if (id === undefined) throw new Error("Missing pile")
  const cleaned = cleanLocalPoop(waiting, dirty.partnerId, id, NOW)
  expect(cleaned.hygiene?.poops).toHaveLength(2)
  const node = DIGIMON_CATALOG.byId.get(dirty.currentNodeId)
  if (!node) throw new Error("Missing companion")
  expect(availableEvolutionTargets(node, 2)).toContain(cleaned.pendingEvolution?.targetNodeId ?? "")
})
