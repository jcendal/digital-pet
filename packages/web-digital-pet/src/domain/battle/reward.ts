import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { BATTLE_EXPERIENCE_FRACTION } from "@jcendal/digital-pet-core/domain/peer-combat.ts"
import { advanceLocalPet, experienceThresholds, type LocalPetState } from "../pet/progress.ts"

/** Never reward a replacement/evolved companion or a changed experience setting. */
export type BattleRewardTarget = Pick<LocalPetState, "partnerId" | "currentNodeId" | "experienceLevel">

export const rewardBattleWinner = (state: LocalPetState, expected: BattleRewardTarget, now: number): LocalPetState => {
  if (
    state.partnerId !== expected.partnerId ||
    state.currentNodeId !== expected.currentNodeId ||
    (state.experienceLevel ?? "high") !== (expected.experienceLevel ?? "high") ||
    state.isTerminal ||
    state.pendingEvolution
  )
    return state
  const node = DIGIMON_CATALOG.byId.get(state.currentNodeId)
  if (!node || node.stage === 0) return state
  const threshold = experienceThresholds(state.experienceLevel)[node.stage]
  return advanceLocalPet(
    {
      ...state,
      gauge: Math.min(threshold, state.gauge + Math.ceil(threshold * BATTLE_EXPERIENCE_FRACTION)),
    },
    now,
  )
}
