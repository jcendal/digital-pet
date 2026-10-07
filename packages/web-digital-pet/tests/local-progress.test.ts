import { describe, expect, it } from "bun:test"

import { advanceLocalPet, EXPERIENCE_INTERVAL_MS, type LocalPetState } from "../src/local-progress.ts"

const initial: LocalPetState = {
  partnerId: "local-partner",
  createdAt: "2026-10-07T00:00:00.000Z",
  currentNodeId: "0-001",
  gauge: 0,
  isTerminal: false,
  lastTickAt: Date.parse("2026-10-07T00:00:00.000Z"),
  events: [{ currentNodeId: "0-001", createdAt: "2026-10-07T00:00:00.000Z" }],
}

describe("browser pet progression", () => {
  it("adds experience once per complete five-minute interval", () => {
    expect(advanceLocalPet(initial, initial.lastTickAt + EXPERIENCE_INTERVAL_MS - 1)).toBe(initial)
    const afterOne = advanceLocalPet(initial, initial.lastTickAt + EXPERIENCE_INTERVAL_MS, () => 0)
    expect(afterOne.gauge).toBeGreaterThan(0)
    expect(afterOne.gauge).toBeLessThan(5_000_000)
    expect(afterOne.lastTickAt).toBe(initial.lastTickAt + EXPERIENCE_INTERVAL_MS)
    expect(advanceLocalPet(afterOne, initial.lastTickAt + EXPERIENCE_INTERVAL_MS, () => 0)).toBe(afterOne)
  })

  it("catches up after the app is closed and records an evolution once", () => {
    const now = initial.lastTickAt + 24 * EXPERIENCE_INTERVAL_MS
    const evolved = advanceLocalPet(initial, now, () => 0)
    expect(evolved.currentNodeId).not.toBe(initial.currentNodeId)
    expect(evolved.gauge).toBe(0)
    expect(evolved.events).toHaveLength(2)
    expect(evolved.events[1]?.createdAt).toBe(new Date(now).toISOString())
    expect(advanceLocalPet(evolved, now, () => 0)).toBe(evolved)
  })
})
