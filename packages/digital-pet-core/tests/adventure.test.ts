import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import {
  ADVENTURE_POLICY,
  type AdventureState,
  adventureOpponent,
  changeAdventure,
  parseAdventure,
} from "../src/domain/adventure.ts"
import {
  type AdventureEncounterKind,
  adventureCooldown,
  adventureQuietTime,
  drawAdventureEncounter,
} from "../src/domain/adventure-pacing.ts"

const current = DIGIMON_CATALOG.byId.get("3-001")!
const same = DIGIMON_CATALOG.byId.get("3-051")!
const higher = DIGIMON_CATALOG.byId.get("4-017")!
const begin = () =>
  changeAdventure(undefined, { kind: "start", id: "trip" }, current, "region", [same], 0, () => 0)!.adventure
const tick = (state: AdventureState, now: number, random = () => 0.9) =>
  changeAdventure(state, { kind: "tick" }, current, "other-region", [same], now, random)!.adventure
const loot = () => {
  let state = begin()
  for (let now = 1000; now <= 45_000; now += 1000) state = tick(state, now)
  return state
}

test("adventures use active time, expire uncollected loot, and never catch up offline", () => {
  const state = loot()
  expect(state.event?.kind).toBe("loot")
  expect(tick(state, 86_400_000).elapsedMs).toBe(46_000)
  let missed = state
  for (let now = 46_000; now <= 53_000; now += 1000) missed = tick(missed, now)
  expect(missed.event).toBeUndefined()
  expect(missed.collected).toBe(0)
  const paused = changeAdventure(state, { kind: "pause" }, current, "region", [same], 45_000)!.adventure
  expect(changeAdventure(paused, { kind: "tick" }, current, "region", [same], 90_000)).toBeUndefined()
  const resumed = changeAdventure(paused, { kind: "resume" }, current, "region", [same], 90_000)!.adventure
  expect(tick(resumed, 91_000).elapsedMs).toBe(46_000)
})

test("loot grants its fraction once and ignores old event IDs and other companions", () => {
  const state = loot()
  const collected = changeAdventure(state, { kind: "collect", eventId: 1 }, current, "region", [same], 45_000)!
  expect(collected.experienceFraction).toBe(0.02)
  expect(collected.adventure.collected).toBe(1)
  expect(
    changeAdventure(collected.adventure, { kind: "collect", eventId: 1 }, current, "region", [same], 45_000),
  ).toBeUndefined()
  expect(changeAdventure(state, { kind: "collect", eventId: 1 }, same, "region", [same], 45_000)).toBeUndefined()
  expect(
    changeAdventure(state, { kind: "collect", eventId: 1, adventureId: "old-trip" }, current, "region", [same], 45_000),
  ).toBeUndefined()
})

test("local opponents match the stage, with rare next-stage encounters and a safe local fallback", () => {
  const sequence = (values: number[]) => () => values.shift() ?? 0
  expect(adventureOpponent(current, [same, higher], sequence([0.5, 0]))).toBe(same)
  expect(adventureOpponent(current, [same, higher], sequence([0.01, 0]))).toBe(higher)
  expect(adventureOpponent(current, [same], sequence([0.01, 0]))).toBe(same)
  expect(adventureOpponent(current, [higher], sequence([0.5, 0]))).toBeUndefined()
  expect(ADVENTURE_POLICY.difficultChance).toBeLessThan(0.1)
})

test("the saved battle plan survives reload and rewards only its completed outcome once", () => {
  const state: AdventureState = {
    ...begin(),
    elapsedMs: 45_000,
    sequence: 1,
    event: {
      kind: "battle",
      id: 1,
      opponentNodeId: higher.id,
      difficult: true,
      completedShots: 0,
      plan: {
        outcome: "player",
        shots: [1, 2, 3].map(() => ({ shooter: "player" as const, hit: true })),
      },
    },
  }
  const reloaded = parseAdventure(JSON.parse(JSON.stringify(state)))!
  expect(reloaded).toEqual(state)
  expect(
    changeAdventure(reloaded, { kind: "finish-battle", eventId: 1 }, current, "region", [higher], 10_000),
  ).toBeUndefined()
  const saved = changeAdventure(
    reloaded,
    { kind: "checkpoint", eventId: 1, completedShots: 3 },
    current,
    "region",
    [higher],
    10_000,
  )!.adventure
  const resolved = changeAdventure(saved, { kind: "finish-battle", eventId: 1 }, current, "region", [higher], 12_000)!
  expect(resolved.experienceFraction).toBe(0.1)
  expect(resolved.adventure.victories).toBe(1)
  expect(
    changeAdventure(resolved.adventure, { kind: "finish-battle", eventId: 1 }, current, "region", [higher], 12_000),
  ).toBeUndefined()
  expect(parseAdventure({ ...state, event: { ...state.event, completedShots: 100 } })).toBeUndefined()
})

test("a defeat returns home without a prize or a gauge penalty; the route continues beyond five active minutes", () => {
  const state = {
    ...begin(),
    event: {
      kind: "battle" as const,
      id: 1,
      opponentNodeId: same.id,
      difficult: false,
      completedShots: 1,
      plan: { outcome: "opponent" as const, shots: [{ shooter: "opponent" as const, hit: false }] },
    },
  }
  const result = changeAdventure(state, { kind: "finish-battle", eventId: 1 }, current, "region", [same], 5000)!
  expect(result.experienceFraction).toBeUndefined()
  expect(result.adventure.status).toBe("defeated")
  expect(result.adventure.running).toBe(false)
  const completed = tick({ ...begin(), elapsedMs: 399_000, nextEventAt: 500_000 }, 1000)
  expect(completed.status).toBe("travel")
  expect(completed.running).toBe(true)
  expect(
    changeAdventure(undefined, { kind: "start", id: "egg" }, DIGIMON_CATALOG.byId.get("0-001")!, "region", [], 0),
  ).toBeUndefined()
})

test("the spawn director spaces encounters and balances each bag without prescribing battle outcomes", () => {
  expect(adventureQuietTime(() => 0)).toBe(45_000)
  expect(adventureQuietTime(() => 1)).toBe(65_000)
  expect(adventureCooldown(() => 0)).toBe(4 * 3600_000)
  expect(adventureCooldown(() => 1)).toBe(6 * 3600_000)
  let remaining: readonly AdventureEncounterKind[] = []
  const kinds: AdventureEncounterKind[] = []
  for (let index = 0; index < 5; index++) {
    const draw = drawAdventureEncounter(remaining, () => 0.7)
    kinds.push(draw.kind)
    remaining = draw.remaining
  }
  expect(kinds.sort()).toEqual(["battle", "battle", "food", "fragment", "fragment"])
  expect(remaining).toHaveLength(0)
  const early = tick({ ...begin(), elapsedMs: 44_000 }, 1000)
  expect(early.event).toBeDefined()
  expect(tick({ ...begin(), elapsedMs: 43_000 }, 1000).event).toBeUndefined()
})

test("a victorious rival offers adoption with 15% probability, and the saved choice cannot reroll or replay", () => {
  const battle: AdventureState = {
    ...begin(),
    event: {
      kind: "battle",
      id: 1,
      opponentNodeId: same.id,
      difficult: false,
      completedShots: 3,
      plan: { outcome: "player", shots: [1, 2, 3].map(() => ({ shooter: "player", hit: true })) },
    },
  }
  const resolve = (roll: number) =>
    changeAdventure(battle, { kind: "finish-battle", eventId: 1 }, current, "region", [same], 60_000, () => roll)!
  expect(resolve(0.15).adventure.event).toBeUndefined()
  const offered = resolve(0.149).adventure
  expect(offered.running).toBe(false)
  expect(offered.event).toEqual({ kind: "offer", id: 1, opponentNodeId: same.id })
  const restored = parseAdventure(JSON.parse(JSON.stringify(offered)))!
  expect(restored).toEqual(offered)
  expect(changeAdventure(restored, { kind: "resume" }, current, "region", [same], 70_000)).toBeUndefined()
  expect(
    changeAdventure(restored, { kind: "accept-companion", eventId: 1 }, current, "region", [same], 70_000),
  ).toBeUndefined()
  const accepted = changeAdventure(
    restored,
    { kind: "accept-companion", eventId: 1, adventureId: restored.id },
    current,
    "region",
    [same],
    70_000,
  )!
  expect(accepted.recruitedNodeId).toBe(same.id)
  expect(accepted.adventure.status).toBe("complete")
  expect(
    changeAdventure(
      accepted.adventure,
      { kind: "accept-companion", eventId: 1, adventureId: restored.id },
      current,
      "region",
      [same],
      70_000,
    ),
  ).toBeUndefined()
  const declined = changeAdventure(
    restored,
    { kind: "decline-companion", eventId: 1, adventureId: restored.id },
    current,
    "region",
    [same],
    70_000,
  )!
  expect(declined.adventure.running).toBe(true)
  expect(declined.recruitedNodeId).toBeUndefined()
  expect(declined.adventure.nextEventAt).toBe(offered.nextEventAt)
})
