import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { type AdventureState, adventureBusy } from "@jcendal/digital-pet-core/domain/adventure.ts"
import type { LocalPartnerState, LocalPetState } from "../pet/progress.ts"
import { partnerState } from "../pet/team.ts"
import { type BattleRewardTarget, rewardBattleWinner } from "./reward.ts"

/** Arena selection follows a partner's identity without changing the care/team slot. */
export const arenaPartner = (state: LocalPetState, selected?: string): LocalPartnerState =>
  state.reserve && state.reserve.partnerId === selected ? state.reserve : state

export const arenaEligible = (partner: LocalPartnerState & { readonly adventure?: AdventureState }): boolean =>
  Boolean(DIGIMON_CATALOG.byId.get(partner.currentNodeId)?.stage) &&
  !partner.pendingEvolution &&
  !adventureBusy(partner.adventure)

export const arenaSnapshot = (state: LocalPetState, partner: LocalPartnerState): LocalPetState => ({
  ...partnerState(partner),
  ...(state.experienceLevel ? { experienceLevel: state.experienceLevel } : {}),
})

/** A reserve fighter earns its own prize while passive timers remain paused. */
export const rewardArenaWinner = (
  state: LocalPetState,
  expected: BattleRewardTarget,
  opponentNodeId: string,
  now: number,
): LocalPetState => {
  if (state.partnerId === expected.partnerId) return rewardBattleWinner(state, expected, opponentNodeId, now)
  const reserve = state.reserve
  if (!reserve || reserve.partnerId !== expected.partnerId || adventureBusy(reserve.adventure)) return state
  const snapshot = arenaSnapshot(state, reserve)
  const next = rewardBattleWinner(snapshot, expected, opponentNodeId, reserve.pausedAt)
  if (next === snapshot || next.gauge <= snapshot.gauge) return state
  // Evolution presentation belongs to the active companion. Keep the earned gauge
  // and let normal activation queue it, so the resting partner never locks Team.
  const { pendingEvolution: _pending, ...updated } = partnerState(next)
  return { ...state, reserve: { ...reserve, ...updated } }
}
