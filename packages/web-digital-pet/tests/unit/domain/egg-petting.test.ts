import { expect, test } from "bun:test"
import {
  completeLocalEvolution,
  experienceThresholds,
  type LocalPetState,
  pendingEvolutionKey,
  petLocalEgg,
} from "../../../src/domain/pet/progress.ts"

const NOW = Date.now()
const egg: LocalPetState = {
  partnerId: "egg",
  createdAt: new Date(NOW).toISOString(),
  currentNodeId: "0-001",
  gauge: 0,
  isTerminal: false,
  lastTickAt: NOW,
  events: [{ currentNodeId: "0-001", createdAt: new Date(NOW).toISOString() }],
}

test("petting earns 1% of the selected egg level without changing history or the time schedule", () => {
  for (const experienceLevel of ["low", "normal", "high"] as const) {
    const next = petLocalEgg({ ...egg, experienceLevel }, egg.partnerId, NOW)
    expect(next.gauge).toBe(experienceThresholds(experienceLevel)[0] * 0.01)
    expect(next.events).toEqual(egg.events)
    expect(next.lastTickAt).toBe(NOW)
  }
})

test("100 clicks queue one hatch; further clicks cannot reward a pending or hatched egg", () => {
  let state = egg
  for (let index = 0; index < 100; index++) state = petLocalEgg(state, egg.partnerId, NOW)
  expect(state.currentNodeId).toBe("0-001")
  expect(state.gauge).toBe(experienceThresholds()[0])
  expect(state.pendingEvolution?.opponentNodeId).toBeNull()
  expect(petLocalEgg(state, egg.partnerId, NOW)).toBe(state)
  const key = pendingEvolutionKey(state)
  if (!key) throw new Error("No pending hatch")
  const hatched = completeLocalEvolution(state, key, true, NOW)
  expect(hatched.currentNodeId).not.toBe(egg.currentNodeId)
  expect(hatched.gauge).toBe(0)
  expect(hatched.events).toHaveLength(2)
  expect(petLocalEgg(hatched, egg.partnerId, NOW)).toBe(hatched)
})

test("stale partner clicks and invalid eggs earn nothing", () => {
  expect(petLocalEgg(egg, "old-egg", NOW)).toBe(egg)
  for (const currentNodeId of ["3-001", "unknown"]) {
    const state = { ...egg, currentNodeId }
    expect(petLocalEgg(state, egg.partnerId, NOW)).toBe(state)
  }
  const terminal = { ...egg, isTerminal: true }
  expect(petLocalEgg(terminal, egg.partnerId, NOW)).toBe(terminal)
})
