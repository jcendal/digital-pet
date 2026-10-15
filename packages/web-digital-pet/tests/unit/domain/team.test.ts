import { expect, test } from "bun:test"
import type { TeamCommand } from "@jcendal/digital-pet-core/domain/partner-team.ts"
import type { LocalPetState } from "../../../src/domain/pet/progress.ts"
import { applyLocalTeamCommand, localTeam } from "../../../src/domain/pet/team.ts"
import { parsePetTransfer } from "../../../src/domain/transfer/protocol.ts"

const now = Date.now()
const state: LocalPetState = {
  partnerId: "principal",
  currentNodeId: "3-001",
  createdAt: new Date(now).toISOString(),
  lastTickAt: now,
  gauge: 10,
  isTerminal: false,
  events: [{ currentNodeId: "3-001", createdAt: new Date(now).toISOString() }],
  food: { kind: "scheduled", availableAt: now + 3600000 },
  adventureReadyAt: now + 1_800_000,
  hygiene: { poops: [now - 1000], nextAt: now + 3600000, happyUntil: 0 },
  worldVisit: { regionId: "digital-ocean", locationId: "dragon-eye-lake" },
}
const command = (pet: LocalPetState, kind: "switch" | "place" = "switch"): TeamCommand =>
  ({
    kind,
    expectedRevision: pet.teamRevision ?? 0,
    expectedPrincipalId: pet.partnerId,
    expectedReserveId: pet.reserve?.partnerId ?? null,
    ...(kind === "place"
      ? {
          slot: "reserve" as const,
          partner: { currentNodeId: "3-022", gauge: 20, isTerminal: false, createdAt: new Date(now).toISOString() },
        }
      : {}),
  }) as TeamCommand

test("switching both ways keeps each companion's experience, victories, care and remaining clocks", () => {
  const principal = { ...state, combatVictories: 11 }
  const placed = applyLocalTeamCommand(principal, command(principal, "place"), "reserve", now, false).state
  expect(placed.partnerId).toBe("principal")
  const switched = applyLocalTeamCommand(placed, command(placed), "ignored", now, false).state
  expect(switched.partnerId).toBe("reserve")
  expect(switched.gauge).toBe(20)
  expect(switched.combatVictories).toBe(0)
  expect(switched.adventureReadyAt).toBe(0)
  expect(switched.reserve?.adventureReadyAt).toBe(state.adventureReadyAt)
  expect(switched.reserve?.combatVictories).toBe(11)
  expect(parsePetTransfer({ version: 3, state: switched }).state.combatVictories).toBe(0)
  expect(parsePetTransfer({ version: 3, state: switched }).state.reserve?.combatVictories).toBe(11)
  const returned = applyLocalTeamCommand(switched, command(switched), "ignored", now + 100_000_000, false).state
  expect(returned.gauge).toBe(10)
  expect(returned.combatVictories).toBe(11)
  expect(returned.hygiene?.poops).toEqual(state.hygiene?.poops)
  expect(returned.hygiene?.nextAt).toBe(now + 100_000_000 + 3600000)
  expect(returned.food).toEqual({ kind: "scheduled", availableAt: now + 100_000_000 + 3600000 })
  expect(returned.adventureReadyAt).toBe(state.adventureReadyAt)
  expect(returned.adventureReadyAt).toBeLessThan(returned.lastTickAt)
  expect(returned.lastTickAt).toBe(now + 100_000_000)
  expect(returned.worldVisit).toEqual(state.worldVisit)
  expect(returned.reserve?.partnerId).toBe("reserve")
})

test("a ready reserve cannot inherit the principal timer, and replacements start with their own clock", () => {
  const placed = applyLocalTeamCommand(state, command(state, "place"), "reserve", now, false).state
  if (!placed.reserve) throw new Error("Missing reserve companion")
  const readyReserve = { ...placed, reserve: { ...placed.reserve, adventureReadyAt: now - 1 } }
  const switched = applyLocalTeamCommand(readyReserve, command(readyReserve), "ignored", now + 1000, false).state
  expect(switched.adventureReadyAt).toBe(now - 1)
  const replacement = applyLocalTeamCommand(
    state,
    {
      ...command(state, "place"),
      kind: "place",
      slot: "principal",
      partner: { currentNodeId: "3-022", gauge: 0, isTerminal: false, createdAt: state.createdAt },
    },
    "new-principal",
    now,
    false,
  ).state
  expect(replacement.adventureReadyAt).toBe(0)
})

test("duplicate commands, busy state and same-identity recruits cannot change the team", () => {
  const create = command(state, "place")
  const placed = applyLocalTeamCommand(state, create, "reserve", now, false).state
  expect(applyLocalTeamCommand(placed, create, "third", now, false).outcome).toEqual({
    kind: "rejected",
    reason: "stale",
  })
  expect(applyLocalTeamCommand(placed, command(placed), "ignored", now, true).state).toBe(placed)
  expect(applyLocalTeamCommand(state, create, state.partnerId, now, false).outcome.kind).toBe("rejected")
  expect(localTeam(placed).reserve?.retiredAt).toBeNull()
})

test("team transfer v2 preserves reserve and imports legacy v1 without dropping fields", () => {
  const placed = applyLocalTeamCommand(state, command(state, "place"), "reserve", now, false).state
  expect(parsePetTransfer({ version: 2, state: placed })).toEqual({ version: 4, state: placed })
  expect(parsePetTransfer({ version: 1, state }).state).toEqual(state)
  expect(() => parsePetTransfer({ version: 1, state: placed })).toThrow()
  expect(() =>
    parsePetTransfer({ version: 2, state: { ...placed, reserve: { ...placed.reserve, partnerId: state.partnerId } } }),
  ).toThrow()
  expect(() =>
    parsePetTransfer({ version: 2, state: { ...placed, reserve: { ...placed.reserve, reserve: placed.reserve } } }),
  ).toThrow()
})

test("replacing reserve archives only the displaced companion and transfers the resulting archive", () => {
  const placed = applyLocalTeamCommand(state, command(state, "place"), "reserve", now, false).state
  const replaced = applyLocalTeamCommand(placed, command(placed, "place"), "new-reserve", now + 1000, false).state
  expect(replaced.partnerId).toBe(state.partnerId)
  expect(replaced.retiredPartners?.map((partner) => partner.partnerId)).toEqual(["reserve"])
  expect(parsePetTransfer({ version: 2, state: replaced }).state).toEqual(replaced)
})

test("egg origins constrain the first form and survive reserve switches and transfers", async () => {
  const { EGG_FAMILIES } = await import("@jcendal/digital-pet-core/data/egg-families.ts")
  const { advanceLocalPet, experienceThresholds } = await import("../../../src/domain/pet/progress.ts")
  for (const family of EGG_FAMILIES) {
    const egg: LocalPetState = {
      ...state,
      currentNodeId: "0-001",
      originEggId: family.id,
      gauge: experienceThresholds()[0],
      hygiene: undefined,
      events: [{ currentNodeId: "0-001", createdAt: state.createdAt }],
    }
    const ready = advanceLocalPet(egg, now, () => 0.999)
    expect(ready.pendingEvolution?.targetNodeId).toBe(family.hatchIds[0])
    expect(parsePetTransfer({ version: 2, state: ready }).state.originEggId).toBe(family.id)
    expect(() =>
      parsePetTransfer({
        version: 2,
        state: {
          ...ready,
          pendingEvolution: { ...ready.pendingEvolution, targetNodeId: "1-001" },
        },
      }),
    ).toThrow()
  }
})

test("switching slots does not renumber either live companion in History", async () => {
  const { archiveFor } = await import("../../../src/domain/pet/models.ts")
  const placed = applyLocalTeamCommand(state, command(state, "place"), "reserve", now + 1000, false).state
  const switched = applyLocalTeamCommand(placed, command(placed), "ignored", now + 2000, false).state
  const identities = (pet: LocalPetState) => {
    const archive = archiveFor(pet)
    if (archive.kind !== "available") throw new Error("Missing history")
    return archive.partners.map((partner) => ({ partnerId: partner.partnerId, generation: partner.generation }))
  }
  expect(identities(switched)).toEqual(identities(placed))
})
