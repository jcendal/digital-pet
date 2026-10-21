import { IntlModule } from "../i18n.ts"
import type { DigimonNode } from "./digimon-node.ts"
import type { EvolutionSelector } from "./evolution.ts"
import { availableEvolutionTargets } from "./evolution-options.ts"

export const isEvolutionBranch = (current: DigimonNode, targetId: string): boolean =>
  current.nextEvolutions.includes(targetId)

export const assertEvolutionBranch = (current: DigimonNode, targetId: string): void => {
  if (!isEvolutionBranch(current, targetId))
    throw new Error(`Evolution ${current.id} -> ${targetId} is outside its branches`)
}

/** Already-saved duels can involve DoneDevimon's former stage-V placement, in either position. */
export const isEvolutionBattleOpponent = (current: DigimonNode, opponent: DigimonNode | undefined): boolean =>
  opponent !== undefined &&
  (opponent.stage === current.stage ||
    (current.id === "5-033" && current.stage === 6 && opponent.stage === 5) ||
    (opponent.id === "5-033" && opponent.stage === 6 && current.stage === 5))

export const pickEvolutionTarget = (
  current: DigimonNode,
  selector: EvolutionSelector,
  uncleanPoops = 0,
  combatVictories = 0,
): string => {
  const targets = availableEvolutionTargets(current, uncleanPoops, combatVictories)
  if (targets.length === 0) {
    throw new Error(IntlModule.translate("errors.noEvolutionOptions"))
  }

  const selection = selector()
  if (!Number.isFinite(selection) || selection < 0 || selection >= 1) {
    throw new Error(`Evolution selector must return a finite number in [0, 1), received ${selection}`)
  }

  const targetId = targets[Math.floor(selection * targets.length)]
  if (targetId === undefined) throw new Error(IntlModule.translate("errors.evolutionSelectionFailed"))
  return targetId
}

export const pickRandomSameStageOpponent = (
  current: DigimonNode,
  catalogNodes: readonly DigimonNode[],
  selector: EvolutionSelector,
): string => {
  const candidates = catalogNodes.filter((node) => node.stage === current.stage && node.id !== current.id)
  if (candidates.length === 0) {
    return current.id
  }

  const selection = selector()
  if (!Number.isFinite(selection) || selection < 0 || selection >= 1) {
    throw new Error(`Evolution selector must return a finite number in [0, 1), received ${selection}`)
  }

  const opponent = candidates[Math.floor(selection * candidates.length)]
  if (opponent === undefined) throw new Error(IntlModule.translate("errors.opponentSelectionFailed"))
  return opponent.id
}
