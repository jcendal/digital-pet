import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { type AdventureState, changeAdventure, parseAdventure } from "../src/domain/adventure.ts"
import {
  ADVENTURE_BATTLE_REWARDS,
  adventureBattleRank,
  chooseAdventureEncounter,
} from "../src/domain/adventure-encounter.ts"

const current = DIGIMON_CATALOG.byId.get("3-001")!
const lower = DIGIMON_CATALOG.byId.get("2-001")!
const same = DIGIMON_CATALOG.byId.get("3-007")!
const higher = DIGIMON_CATALOG.byId.get("4-017")!
const boss = DIGIMON_CATALOG.byId.get("6-095")!
const residents = [lower, same, higher, boss]

test("encounter thresholds give exactly 50/35/10/5 and reserve regional guardians for boss encounters", () => {
  const counts = { lower: 0, same: 0, higher: 0, boss: 0 }
  for (let index = 0; index < 1000; index++) counts[adventureBattleRank(() => index / 1000)]++
  expect(counts).toEqual({ lower: 500, same: 350, higher: 100, boss: 50 })
  for (const [roll, opponent, rank] of [
    [0.499, lower, "lower"],
    [0.5, same, "same"],
    [0.85, higher, "higher"],
    [0.95, boss, "boss"],
  ] as const) {
    const values = [roll, 0]
    expect(chooseAdventureEncounter(current, residents, [boss], () => values.shift() ?? 0)).toEqual({ opponent, rank })
  }
  expect(chooseAdventureEncounter(current, [boss], [boss], () => 0.5)).toBeUndefined()
  expect(chooseAdventureEncounter(lower, [DIGIMON_CATALOG.byId.get("0-001")!, same], [], () => 0)?.opponent).toBe(same)
})

test("each completed victory awards its tier reward, and only a won boss battle records an achievement", () => {
  for (const [rank, opponent] of [
    ["lower", lower],
    ["same", same],
    ["higher", higher],
    ["boss", boss],
  ] as const) {
    const state: AdventureState = {
      id: "trip",
      nodeId: current.id,
      regionId: "digital-ocean",
      running: true,
      elapsedMs: 0,
      lastTickAt: 0,
      nextEventAt: 60000,
      sequence: 1,
      collected: 0,
      victories: 0,
      status: "travel",
      event: {
        kind: "battle",
        id: 1,
        opponentNodeId: opponent.id,
        rank,
        difficult: rank === "boss" || rank === "higher",
        completedShots: 3,
        plan: { outcome: "player", shots: [1, 2, 3].map(() => ({ shooter: "player", hit: true })) },
      },
    }
    const restored = parseAdventure(JSON.parse(JSON.stringify(state)))!
    const won = changeAdventure(
      restored,
      { kind: "finish-battle", eventId: 1 },
      current,
      "digital-ocean",
      residents,
      1000,
      () => 0.9,
      [boss],
    )!
    expect(won.experienceFraction).toBe(ADVENTURE_BATTLE_REWARDS[rank])
    expect(won.defeatedBossNodeId).toBe(rank === "boss" ? boss.id : undefined)
    expect(
      changeAdventure(
        won.adventure,
        { kind: "finish-battle", eventId: 1 },
        current,
        "digital-ocean",
        residents,
        1000,
        () => 0.9,
        [boss],
      ),
    ).toBeUndefined()
    if (state.event?.kind !== "battle") throw new Error("Missing battle")
    const lost = changeAdventure(
      { ...state, event: { ...state.event, plan: { ...state.event.plan, outcome: "opponent" } } },
      { kind: "finish-battle", eventId: 1 },
      current,
      "digital-ocean",
      residents,
      1000,
      () => 0.9,
      [boss],
    )!
    expect(lost.experienceFraction).toBeUndefined()
    expect(lost.defeatedBossNodeId).toBeUndefined()
    expect(parseAdventure({ ...state, event: { ...state.event, rank: "invalid" } })).toBeUndefined()
  }
})

test("both adventure pickups award 2%", () => {
  for (const item of ["food", "fragment"] as const) {
    const state: AdventureState = {
      id: "loot",
      nodeId: current.id,
      regionId: "digital-ocean",
      running: true,
      elapsedMs: 0,
      lastTickAt: 0,
      nextEventAt: 60000,
      sequence: 1,
      collected: 0,
      victories: 0,
      status: "travel",
      event: { kind: "loot", id: 1, item, appearedAt: 0 },
    }
    expect(
      changeAdventure(state, { kind: "collect", eventId: 1 }, current, "digital-ocean", residents, 0)
        ?.experienceFraction,
    ).toBe(0.02)
  }
})

test("missing regional tiers use the nearest available non-egg rival and its actual reward category", () => {
  for (const [roll, pool, opponent, rank] of [
    [0.9, [same], same, "same"],
    [0.5, [higher], higher, "higher"],
  ] as const) {
    const values = [roll, 0]
    expect(chooseAdventureEncounter(current, pool, [], () => values.shift() ?? 0)).toEqual({ opponent, rank })
  }
  expect(chooseAdventureEncounter(current, [], [], () => 0)).toBeUndefined()
})

test("saved legacy boss fights finish but legacy bosses are not selected for new encounters", () => {
  const replacement = DIGIMON_CATALOG.byId.get("5-082")!
  const saved: AdventureState = {
    id: "old-boss",
    nodeId: current.id,
    regionId: "digital-ocean",
    running: true,
    elapsedMs: 1000,
    lastTickAt: 1000,
    nextEventAt: 60000,
    sequence: 1,
    collected: 0,
    victories: 0,
    status: "travel",
    event: {
      kind: "battle",
      id: 1,
      opponentNodeId: boss.id,
      rank: "boss",
      difficult: true,
      completedShots: 3,
      plan: { outcome: "player", shots: [1, 2, 3].map(() => ({ shooter: "player", hit: true })) },
    },
  }
  expect(
    changeAdventure(saved, { kind: "finish-battle", eventId: 1 }, current, saved.regionId, [], 1000, () => 0.9, [
      replacement,
    ]),
  ).toBeUndefined()
  const finished = changeAdventure(
    saved,
    { kind: "finish-battle", eventId: 1 },
    current,
    saved.regionId,
    [],
    1000,
    () => 0.9,
    [replacement],
    [boss],
  )
  expect(finished?.defeatedBossNodeId).toBe(boss.id)
  expect(finished?.experienceFraction).toBe(0.5)
  const values = [0.95, 0]
  expect(chooseAdventureEncounter(current, residents, [replacement], () => values.shift() ?? 0)?.opponent.id).toBe(
    replacement.id,
  )
})
