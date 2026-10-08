import type { WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import {
  advanceFood,
  feedingExperience,
  scheduleFood,
  type FoodState,
} from "@jcendal/digital-pet-core/domain/feeding.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import {
  applyTokenProgress,
  resolveEvolutionBattle,
  STAGE_GAUGE_THRESHOLDS,
  type EvolutionSelector,
  type StageThresholds,
} from "@jcendal/digital-pet-core/domain/evolution.ts"

export const EXPERIENCE_INTERVAL_MS = 5 * 60 * 1000
const TICKS_PER_STAGE = 24

export type ExperienceLevel = "low" | "normal" | "high"
export const isExperienceLevel = (value: unknown): value is ExperienceLevel =>
  value === "low" || value === "normal" || value === "high"

export const experienceMultiplier = (level: ExperienceLevel = "high"): number =>
  level === "low" ? 0.1 : level === "normal" ? 0.5 : 1

export const experienceThresholds = (level: ExperienceLevel = "high"): StageThresholds =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(STAGE_GAUGE_THRESHOLDS).map(([stage, threshold]) => [
        stage,
        threshold * experienceMultiplier(level),
      ]),
    ),
  ) as StageThresholds

export type LocalArchivedPartner = {
  readonly partnerId: string
  readonly createdAt: string
  readonly retiredAt: string
  readonly events: readonly { readonly currentNodeId: string; readonly createdAt: string }[]
}

export type LocalPetState = {
  readonly partnerId: string
  readonly createdAt: string
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly lastTickAt: number
  readonly events: readonly { readonly currentNodeId: string; readonly createdAt: string }[]
  readonly worldVisit?: WorldVisit
  readonly experienceLevel?: ExperienceLevel
  readonly retiredPartners?: readonly LocalArchivedPartner[]
  readonly food?: FoodState
  readonly pendingEvolution?: {
    readonly targetNodeId: string
    readonly opponentNodeId: string | null
    readonly readyAt: number
  }
}

export const advanceLocalPet = (
  initial: LocalPetState,
  now: number,
  selector: EvolutionSelector = Math.random,
): LocalPetState => {
  const current = DIGIMON_CATALOG.byId.get(initial.currentNodeId)
  if (!current) throw new Error(`Unknown browser partner: ${initial.currentNodeId}`)
  const food = advanceFood(initial.food, current.stage === 0, now)
  if (food !== initial.food) {
    const { food: _old, ...rest } = initial
    initial = { ...rest, ...(food ? { food } : {}) }
  }
  if (initial.pendingEvolution || initial.isTerminal) return initial
  const ticks = Math.min(1000, Math.max(0, Math.floor((now - initial.lastTickAt) / EXPERIENCE_INTERVAL_MS)))
  const thresholds = experienceThresholds(initial.experienceLevel)
  if (ticks === 0 && initial.gauge < thresholds[current.stage]) return initial
  let gauge = initial.gauge
  for (let index = 0; index < Math.max(1, ticks); index++) {
    const amount =
      gauge >= thresholds[current.stage] ? 0 : Math.ceil(STAGE_GAUGE_THRESHOLDS[current.stage] / TICKS_PER_STAGE)
    const next = applyTokenProgress(
      { current, gauge, isTerminal: false, pendingEvolutionTargetId: null, battleOpponentNodeId: null },
      amount,
      selector,
      DIGIMON_CATALOG.byId,
      DIGIMON_CATALOG.nodes,
      thresholds,
    )
    const targetNodeId = next.pendingEvolutionTargetId ?? (next.current.id !== current.id ? next.current.id : null)
    if (targetNodeId) {
      return {
        ...initial,
        gauge: thresholds[current.stage],
        lastTickAt: now,
        pendingEvolution: { targetNodeId, opponentNodeId: next.battleOpponentNodeId, readyAt: now },
      }
    }
    if (next.isTerminal) return { ...initial, gauge: 0, isTerminal: true, lastTickAt: now }
    gauge = next.gauge
  }
  return { ...initial, gauge, lastTickAt: initial.lastTickAt + ticks * EXPERIENCE_INTERVAL_MS }
}

export const pendingEvolutionKey = (state: LocalPetState): string | null =>
  state.pendingEvolution ? JSON.stringify([state.partnerId, state.currentNodeId, state.pendingEvolution]) : null

/** Commit only the presentation that is still pending; waiting time earns no extra experience. */
export const completeLocalEvolution = (
  state: LocalPetState,
  expectedKey: string,
  won: boolean,
  now: number,
): LocalPetState => {
  if (!state.pendingEvolution || pendingEvolutionKey(state) !== expectedKey) return state
  const current = DIGIMON_CATALOG.byId.get(state.currentNodeId)
  const pending = state.pendingEvolution
  const target = DIGIMON_CATALOG.byId.get(pending.targetNodeId)
  if (!current || !target || !current.nextEvolutions.includes(target.id)) throw new Error("Invalid pending evolution")
  if ((current.stage === 0) !== (pending.opponentNodeId === null)) throw new Error("Invalid pending evolution battle")
  const resolved =
    pending.opponentNodeId === null
      ? { current: target, isTerminal: target.nextEvolutions.length === 0 }
      : resolveEvolutionBattle(
          {
            current,
            gauge: state.gauge,
            isTerminal: false,
            pendingEvolutionTargetId: target.id,
            battleOpponentNodeId: pending.opponentNodeId,
          },
          won,
          DIGIMON_CATALOG.byId,
        )
  const { pendingEvolution: _pending, ...rest } = state
  return {
    ...rest,
    currentNodeId: resolved.current.id,
    gauge: 0,
    isTerminal: resolved.isTerminal,
    ...(resolved.current.id === current.id ? {} : { food: scheduleFood(now) }),
    lastTickAt: now,
    events:
      resolved.current.id === current.id
        ? state.events
        : [...state.events, { currentNodeId: resolved.current.id, createdAt: new Date(now).toISOString() }],
  }
}

/** Called inside the save transaction: a second click cannot consume the same apple. */
export const consumeLocalFood = (state: LocalPetState, expectedPartnerId: string, now: number): LocalPetState => {
  const current = DIGIMON_CATALOG.byId.get(state.currentNodeId)
  if (
    !current ||
    current.stage === 0 ||
    state.partnerId !== expectedPartnerId ||
    state.pendingEvolution ||
    state.food?.kind !== "available"
  )
    return state
  const fed = {
    ...state,
    food: scheduleFood(now),
    gauge: state.isTerminal
      ? state.gauge
      : feedingExperience(state.gauge, experienceThresholds(state.experienceLevel)[current.stage]),
  }
  return advanceLocalPet(fed, now)
}

export const beginNewPartner = (previous: LocalPetState, partnerId: string, now: number): LocalPetState => {
  const settled = advanceLocalPet(previous, now)
  const createdAt = new Date(now).toISOString()
  return {
    partnerId,
    createdAt,
    currentNodeId: "0-001",
    gauge: 0,
    isTerminal: false,
    lastTickAt: now,
    experienceLevel: settled.experienceLevel ?? "high",
    ...(settled.worldVisit ? { worldVisit: settled.worldVisit } : {}),
    events: [{ currentNodeId: "0-001", createdAt }],
    retiredPartners: [
      ...(settled.retiredPartners ?? []),
      { partnerId: settled.partnerId, createdAt: settled.createdAt, retiredAt: createdAt, events: settled.events },
    ],
  }
}
