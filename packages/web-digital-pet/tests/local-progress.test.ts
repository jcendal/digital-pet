import { describe, expect, it } from "bun:test"

import {
  advanceLocalPet,
  beginNewPartner,
  experienceThresholds,
  EXPERIENCE_INTERVAL_MS,
  type LocalPetState,
} from "../src/local-progress.ts"

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

  it("uses the exact selected experience requirements without changing experience earned per tick", () => {
    const high = experienceThresholds("high")
    const normal = experienceThresholds("normal")
    const low = experienceThresholds("low")
    for (const stage of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
      expect(normal[stage]).toBe(high[stage] / 2)
      expect(low[stage]).toBe(high[stage] / 10)
    }
    for (const [level, ticks] of [
      ["high", 24],
      ["normal", 12],
      ["low", 3],
    ] as const) {
      const configured = { ...initial, experienceLevel: level }
      const before = advanceLocalPet(configured, initial.lastTickAt + (ticks - 1) * EXPERIENCE_INTERVAL_MS, () => 0)
      expect(before.currentNodeId).toBe(initial.currentNodeId)
      const after = advanceLocalPet(configured, initial.lastTickAt + ticks * EXPERIENCE_INTERVAL_MS, () => 0)
      expect(after.currentNodeId).not.toBe(initial.currentNodeId)
    }
  })

  it("starts a fresh egg while preserving retired companions and the experience setting", () => {
    const previous = { ...initial, experienceLevel: "normal" as const }
    const next = beginNewPartner(previous, "new-partner", initial.lastTickAt + EXPERIENCE_INTERVAL_MS)
    expect(next.partnerId).toBe("new-partner")
    expect(next.currentNodeId).toBe("0-001")
    expect(next.gauge).toBe(0)
    expect(next.experienceLevel).toBe("normal")
    expect(next.retiredPartners?.[0]?.partnerId).toBe(previous.partnerId)
    expect(next.retiredPartners?.[0]?.events).toEqual(previous.events)
    const third = beginNewPartner(next, "third-partner", next.lastTickAt + EXPERIENCE_INTERVAL_MS)
    expect(third.retiredPartners?.map((partner) => partner.partnerId)).toEqual(["local-partner", "new-partner"])
  })
})
