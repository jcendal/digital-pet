import { expect, test } from "bun:test"
import { arenaEligible, arenaPartner, arenaSnapshot, rewardArenaWinner } from "../../../src/domain/battle/arena.ts"
import {
  advanceLocalPet,
  experienceThresholds,
  type LocalPetState,
  type LocalReservePartner,
} from "../../../src/domain/pet/progress.ts"
import { applyLocalTeamCommand } from "../../../src/domain/pet/team.ts"

const now = Date.now()
const createdAt = new Date(now).toISOString()
const principal: LocalPetState = {
  partnerId: "principal",
  currentNodeId: "3-001",
  gauge: 123,
  isTerminal: false,
  lastTickAt: now,
  createdAt,
  events: [{ currentNodeId: "3-001", createdAt }],
}
const team: LocalPetState & { reserve: LocalReservePartner } = {
  ...principal,
  reserve: { ...principal, partnerId: "reserve", currentNodeId: "3-073", gauge: 100, pausedAt: now },
}

test("Arena chooses by partner identity without moving team slots, with a safe fallback", () => {
  expect(arenaPartner(principal)).toBe(principal)
  expect(arenaPartner(team)).toBe(team)
  expect(arenaPartner(team, "reserve")).toBe(team.reserve)
  expect(arenaPartner(team, "removed")).toBe(team)
  expect(arenaEligible(arenaPartner(team, "reserve"))).toBe(true)
  expect(arenaEligible({ ...principal, currentNodeId: "0-001" })).toBe(false)
  expect(
    arenaEligible({ ...principal, pendingEvolution: { targetNodeId: "4-001", opponentNodeId: null, readyAt: now } }),
  ).toBe(false)
  expect(arenaSnapshot(team, team.reserve)).not.toHaveProperty("reserve")
  expect(arenaSnapshot(team, team.reserve)).not.toHaveProperty("pausedAt")
})

test("a reserve Arena win rewards only that fighter and keeps its passive clock paused", () => {
  const expected = arenaSnapshot(team, team.reserve)
  const next = rewardArenaWinner(team, expected, "3-001", now + 8 * 60 * 60 * 1000)
  expect(next.partnerId).toBe(team.partnerId)
  expect(next.gauge).toBe(team.gauge)
  expect(next.lastTickAt).toBe(team.lastTickAt)
  expect(next.reserve?.gauge).toBe(100 + experienceThresholds()[3] * 0.2)
  expect(next.reserve?.lastTickAt).toBe(now)
  expect(next.reserve?.pausedAt).toBe(now)
  expect(next.reserve).not.toHaveProperty("experienceLevel")
  expect(next.reserve).not.toHaveProperty("reserve")
})

test("a stale reserve result cannot reward a replacement, evolved partner or different difficulty", () => {
  const expected = arenaSnapshot(team, team.reserve)
  for (const changed of [
    { ...team, reserve: { ...team.reserve, partnerId: "replacement" } },
    { ...team, reserve: { ...team.reserve, currentNodeId: "4-001" } },
    { ...team, experienceLevel: "low" as const },
    principal,
  ])
    expect(rewardArenaWinner(changed, expected, "3-001", now)).toBe(changed)
})

test("a reserve reaching its evolution threshold remains switchable and evolves on activation", () => {
  const almost = { ...team, reserve: { ...team.reserve, gauge: experienceThresholds()[3] * 0.9 } }
  const next = rewardArenaWinner(almost, arenaSnapshot(almost, almost.reserve), "3-001", now)
  expect(next.reserve?.gauge).toBe(experienceThresholds()[3])
  expect(next.reserve?.pendingEvolution).toBeUndefined()
  const switched = applyLocalTeamCommand(
    next,
    { kind: "switch", expectedRevision: 0, expectedPrincipalId: "principal", expectedReserveId: "reserve" },
    "unused",
    now,
    false,
  )
  expect(switched.outcome.kind).toBe("applied")
  expect(switched.state.partnerId).toBe("reserve")
  expect(advanceLocalPet(switched.state, now).pendingEvolution).toBeDefined()
})
