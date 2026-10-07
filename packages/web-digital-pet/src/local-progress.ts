import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import {
  applyTokenProgress,
  resolveEvolutionBattle,
  STAGE_GAUGE_THRESHOLDS,
  type EvolutionSelector,
} from "@jcendal/digital-pet-core/domain/evolution.ts"

export const EXPERIENCE_INTERVAL_MS = 5 * 60 * 1000
const TICKS_PER_STAGE = 24

export type LocalPetState = {
  readonly partnerId: string
  readonly createdAt: string
  readonly currentNodeId: string
  readonly gauge: number
  readonly isTerminal: boolean
  readonly lastTickAt: number
  readonly events: readonly { readonly currentNodeId: string; readonly createdAt: string }[]
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
      STAGE_GAUGE_THRESHOLDS,
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
