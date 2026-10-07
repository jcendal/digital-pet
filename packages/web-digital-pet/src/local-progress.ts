import type { WorldVisit } from "@jcendal/digital-pet-fields/domain/world.ts"
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
}

export const advanceLocalPet = (
  initial: LocalPetState,
  now: number,
  selector: EvolutionSelector = Math.random,
): LocalPetState => {
  const ticks = Math.min(1000, Math.max(0, Math.floor((now - initial.lastTickAt) / EXPERIENCE_INTERVAL_MS)))
  if (ticks === 0) return initial

  let currentNodeId = initial.currentNodeId
  let gauge = initial.gauge
  let isTerminal = initial.isTerminal
  const events = [...initial.events]
  const thresholds = experienceThresholds(initial.experienceLevel)

  for (let index = 0; index < ticks && !isTerminal; index++) {
    const current = DIGIMON_CATALOG.byId.get(currentNodeId)
    if (!current) throw new Error(`Unknown browser partner: ${currentNodeId}`)
    const amount = Math.ceil(STAGE_GAUGE_THRESHOLDS[current.stage] / TICKS_PER_STAGE)
    let next = applyTokenProgress(
      { current, gauge, isTerminal, pendingEvolutionTargetId: null, battleOpponentNodeId: null },
      amount,
      selector,
      DIGIMON_CATALOG.byId,
      DIGIMON_CATALOG.nodes,
      thresholds,
    )
    if (next.pendingEvolutionTargetId !== null) next = resolveEvolutionBattle(next, true, DIGIMON_CATALOG.byId)
    if (next.current.id !== currentNodeId) {
      events.push({
        currentNodeId: next.current.id,
        createdAt: new Date(initial.lastTickAt + (index + 1) * EXPERIENCE_INTERVAL_MS).toISOString(),
      })
    }
    currentNodeId = next.current.id
    gauge = next.gauge
    isTerminal = next.isTerminal
  }

  return {
    ...initial,
    currentNodeId,
    gauge,
    isTerminal,
    lastTickAt: initial.lastTickAt + ticks * EXPERIENCE_INTERVAL_MS,
    events,
  }
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
