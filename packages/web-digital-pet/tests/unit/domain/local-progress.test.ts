import { describe, expect, it } from "bun:test"

import {
  advanceLocalPet,
  beginNewPartner,
  completeLocalEvolution,
  EXPERIENCE_INTERVAL_MS,
  experienceThresholds,
  type LocalPetState,
  pendingEvolutionKey,
} from "../../../src/domain/pet/progress.ts"

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
  it("awards 2% per two hours for every experience setting, retaining partial intervals", () => {
    expect(EXPERIENCE_INTERVAL_MS).toBe(2 * 60 * 60 * 1000)
    for (const experienceLevel of ["low", "normal", "high"] as const) {
      const state = { ...initial, experienceLevel }
      const now = initial.lastTickAt + 3 * EXPERIENCE_INTERVAL_MS + 60_000
      const result = advanceLocalPet(state, now)
      expect(result.gauge).toBe(experienceThresholds(experienceLevel)[0] * 0.06)
      expect(result.lastTickAt).toBe(now - 60_000)
      expect(advanceLocalPet(result, now)).toBe(result)
    }
  })
  it("adds experience once per complete two-hour interval", () => {
    expect(advanceLocalPet(initial, initial.lastTickAt + EXPERIENCE_INTERVAL_MS - 1)).toBe(initial)
    const afterOne = advanceLocalPet(initial, initial.lastTickAt + EXPERIENCE_INTERVAL_MS, () => 0)
    expect(afterOne.gauge).toBe(experienceThresholds()[0] * 0.02)
    expect(afterOne.lastTickAt).toBe(initial.lastTickAt + EXPERIENCE_INTERVAL_MS)
    expect(advanceLocalPet(afterOne, initial.lastTickAt + EXPERIENCE_INTERVAL_MS, () => 0)).toBe(afterOne)
  })

  it("stops at the threshold after a long absence until the evolution is presented", () => {
    const now = initial.lastTickAt + 1000 * EXPERIENCE_INTERVAL_MS
    const ready = advanceLocalPet(initial, now, () => 0)
    expect(ready.currentNodeId).toBe(initial.currentNodeId)
    expect(ready.gauge).toBe(experienceThresholds()[0])
    expect(ready.events).toEqual(initial.events)
    expect(ready.pendingEvolution?.targetNodeId).toBe("1-001")
    expect(ready.pendingEvolution?.opponentNodeId).toBeNull()
    const later = now + 1000 * EXPERIENCE_INTERVAL_MS
    expect(advanceLocalPet(ready, later)).toBe(ready)
    const evolved = completeLocalEvolution(ready, pendingEvolutionKey(ready)!, true, later)
    expect(evolved.currentNodeId).toBe("1-001")
    expect(evolved.gauge).toBe(0)
    expect(evolved.pendingEvolution).toBeUndefined()
    expect(evolved.events).toHaveLength(2)
    expect(evolved.events[1]?.createdAt).toBe(new Date(later).toISOString())
    expect(advanceLocalPet(evolved, later + EXPERIENCE_INTERVAL_MS - 1).gauge).toBe(0)
    expect(completeLocalEvolution(evolved, pendingEvolutionKey(ready)!, true, later)).toBe(evolved)
  })

  it("keeps a battle pending without registering its target, and rejects a stale completion", () => {
    const baby = { ...initial, currentNodeId: "1-001", events: [{ ...initial.events[0]!, currentNodeId: "1-001" }] }
    const ready = advanceLocalPet(baby, baby.lastTickAt + 200 * EXPERIENCE_INTERVAL_MS, () => 0)
    expect(ready.currentNodeId).toBe(baby.currentNodeId)
    expect(ready.pendingEvolution?.opponentNodeId).not.toBeNull()
    expect(ready.events).toEqual(baby.events)
    const replacement = beginNewPartner(ready, "replacement", ready.lastTickAt)
    expect(completeLocalEvolution(replacement, pendingEvolutionKey(ready)!, true, ready.lastTickAt)).toBe(replacement)
    const won = completeLocalEvolution(ready, pendingEvolutionKey(ready)!, true, ready.lastTickAt)
    expect(won.currentNodeId).toBe(ready.pendingEvolution!.targetNodeId)
    expect(won.events).toHaveLength(2)
  })

  it("uses the exact selected experience requirements and earns 2% of each selected requirement per tick", () => {
    const high = experienceThresholds("high")
    const normal = experienceThresholds("normal")
    const low = experienceThresholds("low")
    for (const stage of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
      expect(normal[stage]).toBe(high[stage] / 2)
      expect(low[stage]).toBe(high[stage] / 10)
    }
    for (const [level, ticks] of [
      ["high", 50],
      ["normal", 50],
      ["low", 50],
    ] as const) {
      const configured = { ...initial, experienceLevel: level }
      const before = advanceLocalPet(configured, initial.lastTickAt + (ticks - 1) * EXPERIENCE_INTERVAL_MS, () => 0)
      expect(before.pendingEvolution).toBeUndefined()
      const after = advanceLocalPet(configured, initial.lastTickAt + ticks * EXPERIENCE_INTERVAL_MS, () => 0)
      expect(after.currentNodeId).toBe(initial.currentNodeId)
      expect(after.pendingEvolution).toBeDefined()
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
