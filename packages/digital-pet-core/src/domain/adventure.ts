import { type AdventureEncounterKind, adventureQuietTime, drawAdventureEncounter } from "./adventure-pacing.ts"
import { type BattlePlan, COMBAT_POLICY, planCombat } from "./combat.ts"
import type { DigimonNode } from "./digimon-node.ts"
import { battleExperienceFraction } from "./peer-combat.ts"

export const ADVENTURE_POLICY = Object.freeze({
  lootLifetimeMs: 8_000,
  recruitmentChance: 0.15,
  difficultChance: 0.08,
  foodExperienceFraction: 0.05,
  fragmentExperienceFraction: 0.02,
  battleExperienceMultiplier: 0.25,
  difficultStatBonus: 15,
})

export type AdventureLootKind = "food" | "fragment"
export type AdventureEvent =
  | { readonly kind: "offer"; readonly id: number; readonly opponentNodeId: string }
  | { readonly kind: "loot"; readonly id: number; readonly item: AdventureLootKind; readonly appearedAt: number }
  | {
      readonly kind: "battle"
      readonly id: number
      readonly opponentNodeId: string
      readonly difficult: boolean
      readonly plan: BattlePlan
      readonly completedShots: number
    }
export type AdventureState = {
  readonly id: string
  readonly nodeId: string
  readonly regionId: string
  readonly running: boolean
  readonly elapsedMs: number
  readonly lastTickAt: number
  readonly nextEventAt: number
  readonly encounters?: readonly AdventureEncounterKind[]
  readonly sequence: number
  readonly collected: number
  readonly victories: number
  readonly status: "travel" | "complete" | "defeated" | "evolved"
  readonly event?: AdventureEvent
}
export type AdventureCommand = (
  | { readonly kind: "start"; readonly id: string }
  | { readonly kind: "read" | "resume" | "pause" | "stop" | "tick" }
  | { readonly kind: "accept-companion" | "decline-companion"; readonly eventId: number }
  | { readonly kind: "collect"; readonly eventId: number }
  | { readonly kind: "checkpoint"; readonly eventId: number; readonly completedShots: number }
  | { readonly kind: "finish-battle"; readonly eventId: number }
) & { readonly adventureId?: string }

export type AdventureChange = {
  readonly adventure: AdventureState
  readonly experienceFraction?: number
  readonly recruitedNodeId?: string
}

export const adventureBusy = (state: AdventureState | undefined): boolean =>
  state?.status === "travel" && (state.running || state.event?.kind === "battle" || state.event?.kind === "offer")

export const endAdventure = (state: AdventureState, now: number): AdventureState => ({
  ...withoutEvent(state),
  running: false,
  status: "evolved",
  lastTickAt: now,
})

const withoutEvent = (state: AdventureState): AdventureState => {
  const { event: _event, ...rest } = state
  return rest
}

/** Only residents of the chosen region can be encountered; an absent higher tier falls back to the current tier. */
export const adventureOpponent = (
  current: DigimonNode,
  residents: readonly DigimonNode[],
  random: () => number,
): DigimonNode | undefined => {
  const difficult = random() < ADVENTURE_POLICY.difficultChance
  const same = residents.filter((node) => node.stage === current.stage)
  const higher = difficult ? residents.filter((node) => node.stage === current.stage + 1) : []
  const pool = higher.length ? higher : same
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

export const changeAdventure = (
  state: AdventureState | undefined,
  command: AdventureCommand,
  current: DigimonNode,
  regionId: string,
  residents: readonly DigimonNode[],
  now: number,
  random: () => number = Math.random,
): AdventureChange | undefined => {
  if (current.stage === 0 || !Number.isFinite(now)) return undefined
  if (command.adventureId !== undefined && command.adventureId !== state?.id) return undefined
  if (command.kind === "read") return state?.nodeId === current.id ? { adventure: state } : undefined
  if (command.kind === "start") {
    if (state?.id === command.id || !command.id) return undefined
    if (state && state.nodeId === current.id && state.status === "travel") return undefined
    return {
      adventure: {
        id: command.id,
        nodeId: current.id,
        regionId,
        running: true,
        elapsedMs: 0,
        lastTickAt: now,
        nextEventAt: adventureQuietTime(random),
        encounters: [],
        sequence: 0,
        collected: 0,
        victories: 0,
        status: "travel",
      },
    }
  }
  if (!state || state.nodeId !== current.id || state.status !== "travel") return undefined
  if (command.kind === "resume" && state.event?.kind === "offer") return undefined
  if (command.kind === "pause" || command.kind === "resume")
    return { adventure: { ...state, running: command.kind === "resume", lastTickAt: now } }
  if (command.kind === "stop")
    return { adventure: { ...withoutEvent(state), running: false, status: "complete", lastTickAt: now } }
  const event = state.event
  if (command.kind === "accept-companion" || command.kind === "decline-companion") {
    if (event?.kind !== "offer" || event.id !== command.eventId || command.adventureId !== state.id) return undefined
    const opponent = residents.find((node) => node.id === event.opponentNodeId)
    if (!opponent || opponent.stage === 0) return undefined
    const accepted = command.kind === "accept-companion"
    return {
      adventure: {
        ...withoutEvent(state),
        running: !accepted,
        status: accepted ? "complete" : "travel",
        lastTickAt: now,
      },
      ...(accepted ? { recruitedNodeId: opponent.id } : {}),
    }
  }
  if (!state.running) return undefined
  if (command.kind === "checkpoint") {
    if (
      event?.kind !== "battle" ||
      event.id !== command.eventId ||
      !Number.isInteger(command.completedShots) ||
      command.completedShots < event.completedShots ||
      command.completedShots > event.plan.shots.length
    )
      return undefined
    return { adventure: { ...state, event: { ...event, completedShots: command.completedShots }, lastTickAt: now } }
  }
  if (command.kind === "finish-battle") {
    if (event?.kind !== "battle" || event.id !== command.eventId || event.completedShots !== event.plan.shots.length)
      return undefined
    const opponent = residents.find((node) => node.id === event.opponentNodeId)
    const won = event.plan.outcome === "player"
    const lost = event.plan.outcome === "opponent"
    const offer = won && opponent && random() < ADVENTURE_POLICY.recruitmentChance
    return {
      adventure: {
        ...withoutEvent(state),
        running: !lost && !offer,
        ...(offer ? { event: { kind: "offer" as const, id: event.id, opponentNodeId: opponent.id } } : {}),
        status: lost ? "defeated" : "travel",
        victories: state.victories + Number(won),
        lastTickAt: now,
        nextEventAt: state.elapsedMs + adventureQuietTime(random),
      },
      ...(won && opponent
        ? {
            experienceFraction:
              battleExperienceFraction(current.stage, opponent.stage) * ADVENTURE_POLICY.battleExperienceMultiplier,
          }
        : {}),
    }
  }
  if (command.kind === "collect") {
    if (
      event?.kind !== "loot" ||
      event.id !== command.eventId ||
      state.elapsedMs - event.appearedAt >= ADVENTURE_POLICY.lootLifetimeMs
    )
      return undefined
    return {
      adventure: { ...withoutEvent(state), collected: state.collected + 1 },
      experienceFraction:
        event.item === "food" ? ADVENTURE_POLICY.foodExperienceFraction : ADVENTURE_POLICY.fragmentExperienceFraction,
    }
  }
  if (event?.kind === "battle") return undefined
  // A heartbeat advances at most one second. Closed/hidden time never catches up or generates rewards.
  const elapsedMs = state.elapsedMs + Math.max(0, Math.min(1000, now - state.lastTickAt))
  let next = { ...state, elapsedMs, lastTickAt: now }
  if (event?.kind === "loot" && elapsedMs - event.appearedAt >= ADVENTURE_POLICY.lootLifetimeMs)
    next = withoutEvent(next)
  if (!next.event && elapsedMs >= next.nextEventAt) {
    const id = next.sequence + 1
    const draw = drawAdventureEncounter(next.encounters ?? [], random)
    const opponent = draw.kind === "battle" ? adventureOpponent(current, residents, random) : undefined
    const difficulty = opponent && opponent.stage > current.stage ? ADVENTURE_POLICY.difficultStatBonus : 0
    const encounter: AdventureEvent = opponent
      ? {
          kind: "battle",
          id,
          opponentNodeId: opponent.id,
          difficult: Boolean(difficulty),
          completedShots: 0,
          plan: planCombat(
            current.combatStats,
            {
              strength: Math.min(100, opponent.combatStats.strength + difficulty),
              evasion: Math.min(100, opponent.combatStats.evasion + difficulty),
            },
            random,
          ),
        }
      : { kind: "loot", id, item: draw.kind === "food" ? "food" : "fragment", appearedAt: elapsedMs }
    next = {
      ...next,
      encounters: draw.remaining,
      event: encounter,
      sequence: id,
      nextEventAt: elapsedMs + adventureQuietTime(random),
    }
  }
  return { adventure: next }
}

/** Saved adventures are optional; reject malformed external/legacy state rather than executing an invalid plan. */
export const parseAdventure = (raw: unknown): AdventureState | undefined => {
  if (!raw || typeof raw !== "object") return undefined
  const state = raw as Partial<AdventureState>
  if (
    typeof state.id !== "string" ||
    !state.id ||
    typeof state.nodeId !== "string" ||
    typeof state.regionId !== "string" ||
    typeof state.running !== "boolean" ||
    !["travel", "complete", "defeated", "evolved"].includes(state.status ?? "") ||
    ![state.elapsedMs, state.lastTickAt, state.nextEventAt, state.sequence, state.collected, state.victories].every(
      (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
    ) ||
    (state.encounters !== undefined &&
      (!Array.isArray(state.encounters) ||
        state.encounters.length > 5 ||
        !state.encounters.every((kind) => ["fragment", "food", "battle"].includes(kind))))
  )
    return undefined
  const event = state.event
  if (event !== undefined) {
    if (!event || typeof event !== "object") return undefined
    if (!Number.isSafeInteger(event.id) || event.id < 1) return undefined
    if (event.kind === "loot") {
      if (!["food", "fragment"].includes(event.item) || !Number.isFinite(event.appearedAt) || event.appearedAt < 0)
        return undefined
    } else if (event.kind === "offer") {
      if (typeof event.opponentNodeId !== "string" || state.running || state.status !== "travel") return undefined
    } else if (event.kind === "battle") {
      if (
        typeof event.opponentNodeId !== "string" ||
        typeof event.difficult !== "boolean" ||
        !event.plan ||
        !["player", "opponent", "draw"].includes(event.plan.outcome) ||
        !Array.isArray(event.plan.shots) ||
        !event.plan.shots.length ||
        event.plan.shots.length > COMBAT_POLICY.maxShots ||
        !event.plan.shots.every(
          (shot) => shot && ["player", "opponent"].includes(shot.shooter) && typeof shot.hit === "boolean",
        ) ||
        !Number.isInteger(event.completedShots) ||
        event.completedShots < 0 ||
        event.completedShots > event.plan.shots.length
      )
        return undefined
    } else return undefined
  }
  return state as AdventureState
}
