import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { eggNodeForOrigin } from "@jcendal/digital-pet-core/data/egg-families.ts"
import type { AdventureState } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { BossVictory } from "@jcendal/digital-pet-core/domain/boss-victory.ts"
import { eggPettingExperience } from "@jcendal/digital-pet-core/domain/egg-petting.ts"
import {
  applyTokenProgress,
  type EvolutionSelector,
  resolveEvolutionBattle,
  STAGE_GAUGE_THRESHOLDS,
  type StageThresholds,
} from "@jcendal/digital-pet-core/domain/evolution.ts"
import {
  advanceFood,
  type FoodState,
  feedingExperience,
  scheduleFood,
} from "@jcendal/digital-pet-core/domain/feeding.ts"
import {
  advanceHygiene,
  cleanHygiene,
  cleaningExperience,
  createHygiene,
  type HygieneState,
} from "@jcendal/digital-pet-core/domain/hygiene.ts"
import type { WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
import { IntlModule } from "../../shared/i18n.ts"

export const EXPERIENCE_INTERVAL_MS = 2 * 60 * 60 * 1000
export const BROWSER_FEEDING_POLICY = Object.freeze({ intervalMs: 60 * 60 * 1000, experienceFraction: 0.05 })
const TIMED_EXPERIENCE_FRACTION = 0.02

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

export type LocalPartnerState = {
  readonly adventureReadyAt?: number
  readonly combatVictories?: number
  readonly originEggId?: string
  readonly partnerId: string
  readonly createdAt: string
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly lastTickAt: number
  readonly events: readonly { readonly currentNodeId: string; readonly createdAt: string }[]
  readonly food?: FoodState
  readonly hygiene?: HygieneState
  readonly pendingEvolution?: {
    readonly targetNodeId: string | null
    readonly opponentNodeId: string | null
    readonly readyAt: number
  }
}

export type LocalReservePartner = LocalPartnerState & {
  readonly pausedAt: number
  readonly adventure?: AdventureState
}

export type LocalPetState = LocalPartnerState & {
  readonly bossVictories?: readonly BossVictory[]
  readonly worldVisit?: WorldVisit
  readonly experienceLevel?: ExperienceLevel
  readonly retiredPartners?: readonly LocalArchivedPartner[]
  readonly reserve?: LocalReservePartner
  readonly teamRevision?: number
}

export const advanceLocalPet = (
  initial: LocalPetState,
  now: number,
  selector: EvolutionSelector = Math.random,
): LocalPetState => {
  const catalogNode = DIGIMON_CATALOG.byId.get(initial.currentNodeId)
  if (!catalogNode)
    throw new Error(IntlModule.translate("progress.unknownBrowserPartner", { currentNodeId: initial.currentNodeId }))
  const current = eggNodeForOrigin(catalogNode, initial.originEggId)
  // Old final forms stopped accruing EXP. Resume from now without awarding dormant time.
  if (initial.isTerminal && current.stage > 0) initial = { ...initial, isTerminal: false, lastTickAt: now }
  if (initial.reserve?.isTerminal && DIGIMON_CATALOG.byId.get(initial.reserve.currentNodeId)?.stage !== 0)
    initial = { ...initial, reserve: { ...initial.reserve, isTerminal: false, lastTickAt: initial.reserve.pausedAt } }
  const hygiene = advanceHygiene(initial.hygiene, current.stage === 0, now)
  if (hygiene !== initial.hygiene) {
    const { hygiene: _old, ...rest } = initial
    initial = { ...rest, ...(hygiene ? { hygiene } : {}) }
  }
  // Shorten a legacy four-hour schedule on its first visit under the hourly policy.
  const scheduled = initial.food
  const adjusted =
    scheduled?.kind === "scheduled" && scheduled.availableAt > now + BROWSER_FEEDING_POLICY.intervalMs
      ? scheduleFood(now, BROWSER_FEEDING_POLICY)
      : scheduled
  const food = advanceFood(adjusted, current.stage === 0, now, BROWSER_FEEDING_POLICY)
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
      gauge >= thresholds[current.stage] ? 0 : Math.ceil(thresholds[current.stage] * TIMED_EXPERIENCE_FRACTION)
    const next = applyTokenProgress(
      { current, gauge, isTerminal: false, pendingEvolutionTargetId: null, battleOpponentNodeId: null },
      amount,
      selector,
      DIGIMON_CATALOG.byId,
      DIGIMON_CATALOG.nodes,
      thresholds,
      initial.hygiene?.poops.length ?? 0,
    )
    const targetNodeId = next.pendingEvolutionTargetId ?? (next.current.id !== current.id ? next.current.id : null)
    if (targetNodeId || next.battleOpponentNodeId) {
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

export const petLocalEgg = (state: LocalPetState, expectedPartnerId: string, now: number): LocalPetState => {
  const current = DIGIMON_CATALOG.byId.get(state.currentNodeId)
  if (
    !current ||
    current.stage !== 0 ||
    state.partnerId !== expectedPartnerId ||
    state.pendingEvolution ||
    state.isTerminal
  )
    return state
  return advanceLocalPet(
    { ...state, gauge: eggPettingExperience(state.gauge, experienceThresholds(state.experienceLevel)[0]) },
    now,
  )
}

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
  const target = pending.targetNodeId ? DIGIMON_CATALOG.byId.get(pending.targetNodeId) : undefined
  if (!current || (pending.targetNodeId !== null && (!target || !current.nextEvolutions.includes(target.id))))
    throw new Error(IntlModule.translate("progress.invalidPendingEvolution"))
  if ((current.stage === 0) !== (pending.opponentNodeId === null))
    throw new Error(IntlModule.translate("progress.invalidPendingEvolutionBattle"))
  const resolved =
    pending.opponentNodeId === null
      ? target
        ? { current: target, isTerminal: false, combatVictories: 0 }
        : (() => {
            throw new Error("Missing hatch target")
          })()
      : resolveEvolutionBattle(
          {
            current,
            gauge: state.gauge,
            isTerminal: false,
            pendingEvolutionTargetId: pending.targetNodeId,
            battleOpponentNodeId: pending.opponentNodeId,
            combatVictories: state.combatVictories ?? 0,
          },
          won,
          DIGIMON_CATALOG.byId,
          advanceHygiene(state.hygiene, false, now)?.poops.length ?? 0,
        )
  const { pendingEvolution: _pending, ...rest } = state
  return {
    ...rest,
    currentNodeId: resolved.current.id,
    gauge: 0,
    isTerminal: resolved.isTerminal,
    combatVictories: resolved.combatVictories ?? 0,
    ...(current.stage === 0 ? { hygiene: createHygiene(now) } : {}),
    ...(resolved.current.id === current.id ? {} : { food: scheduleFood(now, BROWSER_FEEDING_POLICY) }),
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
    food: scheduleFood(now, BROWSER_FEEDING_POLICY),
    gauge: state.isTerminal
      ? state.gauge
      : feedingExperience(
          state.gauge,
          experienceThresholds(state.experienceLevel)[current.stage],
          BROWSER_FEEDING_POLICY,
        ),
  }
  return advanceLocalPet(fed, now)
}

export const cleanLocalPoop = (state: LocalPetState, partnerId: string, poopId: number, now: number): LocalPetState => {
  const current = DIGIMON_CATALOG.byId.get(state.currentNodeId)
  if (!current?.stage || state.partnerId !== partnerId || state.pendingEvolution || !state.hygiene) return state
  const hygiene = cleanHygiene(state.hygiene, poopId, now)
  if (hygiene === state.hygiene) return state
  return advanceLocalPet(
    {
      ...state,
      hygiene,
      gauge: state.isTerminal
        ? state.gauge
        : cleaningExperience(state.gauge, experienceThresholds(state.experienceLevel)[current.stage]),
    },
    now,
  )
}

export const beginNewPartner = (previous: LocalPetState, partnerId: string, now: number): LocalPetState =>
  replaceLocalPartner(advanceLocalPet(previous, now), partnerId, now, "0-001", false)

export const replaceLocalPartner = (
  settled: LocalPetState,
  partnerId: string,
  now: number,
  nodeId: string,
  isTerminal: boolean,
): LocalPetState => {
  const createdAt = new Date(now).toISOString()
  return {
    partnerId,
    createdAt,
    currentNodeId: nodeId,
    gauge: 0,
    isTerminal,
    lastTickAt: now,
    experienceLevel: settled.experienceLevel ?? "high",
    ...(settled.bossVictories ? { bossVictories: settled.bossVictories } : {}),
    ...(settled.worldVisit ? { worldVisit: settled.worldVisit } : {}),
    ...(settled.reserve ? { reserve: settled.reserve } : {}),
    ...(settled.teamRevision !== undefined ? { teamRevision: settled.teamRevision + 1 } : {}),
    combatVictories: 0,
    adventureReadyAt: 0,
    events: [{ currentNodeId: nodeId, createdAt }],
    retiredPartners: [
      ...(settled.retiredPartners ?? []),
      { partnerId: settled.partnerId, createdAt: settled.createdAt, retiredAt: createdAt, events: settled.events },
    ],
  }
}
