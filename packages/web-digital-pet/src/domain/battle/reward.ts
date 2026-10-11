import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { battleExperienceFraction } from "@jcendal/digital-pet-core/domain/peer-combat.ts"
import { advanceLocalPet, experienceThresholds, type LocalPetState } from "../pet/progress.ts"

/** Never reward a replacement/evolved companion or a changed experience setting. */
export type BattleRewardTarget = Pick<LocalPetState, "partnerId" | "currentNodeId" | "experienceLevel">

export const rewardBattleWinner = (
  state: LocalPetState,
  expected: BattleRewardTarget,
  opponentNodeId: string,
  now: number,
): LocalPetState => {
  if (
    state.partnerId !== expected.partnerId ||
    state.currentNodeId !== expected.currentNodeId ||
    (state.experienceLevel ?? "high") !== (expected.experienceLevel ?? "high") ||
    state.isTerminal ||
    state.pendingEvolution
  )
    return state
  const node = DIGIMON_CATALOG.byId.get(state.currentNodeId)
  const opponent = DIGIMON_CATALOG.byId.get(opponentNodeId)
  if (!node || node.stage === 0 || !opponent || opponent.stage === 0) return state
  const threshold = experienceThresholds(state.experienceLevel)[node.stage]
  const fraction = battleExperienceFraction(node.stage, opponent.stage)
  return advanceLocalPet(
    {
      ...state,
      gauge: Math.min(threshold, state.gauge + Math.ceil(threshold * fraction)),
    },
    now,
  )
}
