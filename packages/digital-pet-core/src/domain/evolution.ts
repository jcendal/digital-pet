import { IntlModule } from "../i18n.ts"
import type { DigimonNode } from "./digimon-node.ts"
import {
  assertEvolutionBranch,
  isEvolutionBattleOpponent,
  pickEvolutionTarget,
  pickRandomSameStageOpponent,
} from "./evolution-battle.ts"
import { availableEvolutionTargets } from "./evolution-options.ts"
import { DIGIMON_STAGES, type DigimonStage } from "./stage.ts"

export type StageThresholds = Readonly<Record<DigimonStage, number>>

export const STAGE_GAUGE_THRESHOLDS = Object.freeze({
  0: 5_000_000,
  1: 10_000_000,
  2: 20_000_000,
  3: 40_000_000,
  4: 75_000_000,
  5: 125_000_000,
  6: 200_000_000,
  7: 300_000_000,
} as const satisfies StageThresholds)

export type PartnerEvolutionState = {
  readonly current: DigimonNode
  readonly gauge: number
  readonly isTerminal: boolean
  readonly pendingEvolutionTargetId: string | null
  readonly battleOpponentNodeId: string | null
  readonly combatVictories?: number
}

export type EvolutionSelector = () => number

const isRecord = (value: unknown): value is Readonly<Record<PropertyKey, unknown>> => {
  return typeof value === "object" && value !== null
}

const isStageThresholds = (thresholds: unknown): thresholds is StageThresholds => {
  if (!isRecord(thresholds) || !Object.isFrozen(thresholds)) return false

  return DIGIMON_STAGES.every((stage) => {
    const threshold = thresholds[stage]
    return typeof threshold === "number" && Number.isFinite(threshold) && threshold > 0
  })
}

const hasPendingBattle = (state: PartnerEvolutionState): boolean => state.battleOpponentNodeId != null

export const applyTokenProgress = (
  state: PartnerEvolutionState,
  tokenDelta: number,
  selector: EvolutionSelector,
  digimonById: ReadonlyMap<string, DigimonNode>,
  catalogNodes: readonly DigimonNode[],
  thresholds: unknown,
  uncleanPoops = 0,
): PartnerEvolutionState => {
  if (!isStageThresholds(thresholds)) {
    throw new Error(IntlModule.translate("errors.invalidEvolutionThresholds"))
  }
  if (state.isTerminal) return state
  if (hasPendingBattle(state)) return state

  const threshold = thresholds[state.current.stage]
  const gauge = state.gauge + tokenDelta
  if (gauge < threshold) return { ...state, gauge }
  if (state.current.stage === 0) {
    const targetId = pickEvolutionTarget(state.current, selector, uncleanPoops)
    const target = digimonById.get(targetId)
    if (!target) throw new Error(`Evolution target ${targetId} is missing from the catalog`)
    return {
      current: target,
      gauge: 0,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
    }
  }

  const battleOpponentNodeId = pickRandomSameStageOpponent(state.current, catalogNodes, selector)
  if (digimonById.get(battleOpponentNodeId) === undefined) {
    throw new Error(`Battle opponent ${battleOpponentNodeId} is missing from the catalog`)
  }

  return {
    ...state,
    gauge: threshold,
    isTerminal: false,
    pendingEvolutionTargetId: null,
    battleOpponentNodeId,
  }
}

export const resolveEvolutionBattle = (
  state: PartnerEvolutionState,
  won: boolean,
  digimonById: ReadonlyMap<string, DigimonNode>,
  uncleanPoops = 0,
  selector: EvolutionSelector = Math.random,
): PartnerEvolutionState => {
  const targetId = state.pendingEvolutionTargetId
  const opponentId = state.battleOpponentNodeId
  if (opponentId === null) {
    throw new Error(IntlModule.translate("errors.noPendingBattle"))
  }

  if (targetId !== null) assertEvolutionBranch(state.current, targetId)
  const opponent = digimonById.get(opponentId)
  if (!isEvolutionBattleOpponent(state.current, opponent))
    throw new Error(IntlModule.translate("errors.invalidEvolutionOpponent"))

  if (!won) {
    return {
      current: state.current,
      gauge: 0,
      isTerminal: state.isTerminal,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
      combatVictories: state.combatVictories ?? 0,
    }
  }

  const victories = Math.min(1_000_000, (state.combatVictories ?? 0) + 1)
  const eligible = availableEvolutionTargets(state.current, uncleanPoops, victories)
  const selected =
    targetId ?? (eligible.length ? pickEvolutionTarget(state.current, selector, uncleanPoops, victories) : undefined)
  const current = selected ? digimonById.get(selected) : state.current
  if (!current) throw new Error(`Evolution target ${selected} is missing from the catalog`)
  return {
    current,
    gauge: 0,
    isTerminal: false,
    pendingEvolutionTargetId: null,
    battleOpponentNodeId: null,
    combatVictories: current.id === state.current.id ? victories : 0,
  }
}
