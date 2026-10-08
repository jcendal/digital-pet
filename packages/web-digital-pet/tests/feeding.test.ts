import { expect, test } from "bun:test"
import { FEEDING_POLICY } from "@jcendal/digital-pet-core/domain/feeding.ts"
import {
  advanceLocalPet,
  completeLocalEvolution,
  consumeLocalFood,
  experienceThresholds,
  pendingEvolutionKey,
  beginNewPartner,
  type LocalPetState,
} from "../src/local-progress.ts"
import { parsePetTransfer } from "../src/transfer-protocol.ts"

const now = Date.now()
const partner: LocalPetState = {
  partnerId: "food-pet",
  createdAt: new Date(now).toISOString(),
  currentNodeId: "3-001",
  gauge: 0,
  isTerminal: false,
  lastTickAt: now,
  events: [{ currentNodeId: "3-001", createdAt: new Date(now).toISOString() }],
}

test("old saves schedule one apple without retroactive feeding; eggs never have food", () => {
  const scheduled = advanceLocalPet(partner, now)
  expect(scheduled.food).toEqual({ kind: "scheduled", availableAt: now + FEEDING_POLICY.intervalMs })
  const available = advanceLocalPet({ ...scheduled, isTerminal: true }, now + FEEDING_POLICY.intervalMs)
  expect(available.food).toEqual({ kind: "available" })
  expect(advanceLocalPet(available, now + 100 * FEEDING_POLICY.intervalMs)).toBe(available)
  const egg = beginNewPartner(available, "new-egg", now)
  expect(advanceLocalPet(egg, now).food).toBeUndefined()
})

test("an apple awards exactly 25% of the chosen stage requirement and resets its clock", () => {
  for (const experienceLevel of ["low", "normal", "high"] as const) {
    const hungry = { ...partner, experienceLevel, food: { kind: "available" as const } }
    const fed = consumeLocalFood(hungry, partner.partnerId, now)
    expect(fed.gauge).toBe(experienceThresholds(experienceLevel)[3] / 4)
    expect(fed.food).toEqual({ kind: "scheduled", availableAt: now + FEEDING_POLICY.intervalMs })
    expect(consumeLocalFood(fed, partner.partnerId, now)).toBe(fed)
    expect(consumeLocalFood(hungry, "replaced-pet", now)).toBe(hungry)
  }
})

test("feeding caps experience and queues a visible evolution without registering it", () => {
  const hungry = { ...partner, gauge: experienceThresholds()[3] * 0.9, food: { kind: "available" as const } }
  const ready = consumeLocalFood(hungry, partner.partnerId, now)
  expect(ready.currentNodeId).toBe(partner.currentNodeId)
  expect(ready.gauge).toBe(experienceThresholds()[3])
  expect(ready.pendingEvolution).toBeDefined()
  expect(ready.events).toEqual(partner.events)
  expect(consumeLocalFood({ ...ready, food: { kind: "available" } }, partner.partnerId, now).gauge).toBe(ready.gauge)
  const evolved = completeLocalEvolution(ready, pendingEvolutionKey(ready)!, true, now + 1000)
  expect(evolved.food).toEqual({ kind: "scheduled", availableAt: now + 1000 + FEEDING_POLICY.intervalMs })
  const lost = completeLocalEvolution(ready, pendingEvolutionKey(ready)!, false, now + 1000)
  expect(lost.food).toEqual(ready.food)
})

test("food survives transfers; ambiguous clocks and egg food are rejected", () => {
  for (const food of [
    { kind: "available" } as const,
    { kind: "scheduled", availableAt: now + FEEDING_POLICY.intervalMs } as const,
  ]) {
    const state = { ...partner, food }
    expect(parsePetTransfer({ version: 1, state }).state).toEqual(state)
  }
  for (const food of [
    { kind: "available", availableAt: now },
    { kind: "scheduled", availableAt: NaN },
    { kind: "scheduled", availableAt: -1 },
  ])
    expect(() => parsePetTransfer({ version: 1, state: { ...partner, food } })).toThrow("food")
  expect(() =>
    parsePetTransfer({ version: 1, state: { ...beginNewPartner(partner, "egg", now), food: { kind: "available" } } }),
  ).toThrow("food")
})

test("terminal companions can eat without gaining irrelevant experience", () => {
  const final = { ...partner, currentNodeId: "7-011", isTerminal: true, food: { kind: "available" as const } }
  const fed = consumeLocalFood(final, final.partnerId, now)
  expect(fed.gauge).toBe(0)
  expect(fed.pendingEvolution).toBeUndefined()
  expect(fed.food?.kind).toBe("scheduled")
})
