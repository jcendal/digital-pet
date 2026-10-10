import type { DigimonCatalog } from "../../domain/digimon-node.ts"
import { eggPettingExperience } from "../../domain/egg-petting.ts"
import { applyTokenProgress, type EvolutionSelector, type StageThresholds } from "../../domain/evolution.ts"
import type { UsageEvolutionTransition } from "../models/usage.ts"
import type { EggPettingStore } from "../ports/egg-petting.ts"

export type EggPettingService = {
  petEgg: (
    partnerId: string,
    interactionId: string,
    now: number,
  ) => { readonly accepted: true; readonly evolution?: UsageEvolutionTransition } | { readonly accepted: false }
}

export const createEggPettingService = (
  store: EggPettingStore,
  catalog: DigimonCatalog,
  thresholds: StageThresholds,
  selector: EvolutionSelector = Math.random,
): EggPettingService => ({
  petEgg(partnerId, interactionId, now) {
    let evolution: UsageEvolutionTransition | undefined
    const accepted = store.updateEgg(partnerId, interactionId, new Date(now).toISOString(), (snapshot) => {
      const { partner, frozen, isSetOverride } = snapshot
      const current = catalog.byId.get(partner.currentNodeId)
      if (
        partner.partnerId !== partnerId ||
        !current ||
        current.stage !== 0 ||
        frozen ||
        isSetOverride ||
        partner.isTerminal ||
        partner.pendingEvolutionTargetId !== null
      )
        return undefined
      const gauge = eggPettingExperience(partner.gauge, thresholds[0])
      const progress = applyTokenProgress(
        {
          current,
          gauge: partner.gauge,
          isTerminal: false,
          pendingEvolutionTargetId: null,
          battleOpponentNodeId: null,
        },
        gauge - partner.gauge,
        selector,
        catalog.byId,
        catalog.nodes,
        thresholds,
      )
      if (progress.current.id !== current.id) evolution = { fromNodeId: current.id, toNodeId: progress.current.id }
      return {
        currentNodeId: progress.current.id,
        gauge: progress.gauge,
        isTerminal: progress.isTerminal,
        pendingEvolutionTargetId: progress.pendingEvolutionTargetId,
        battleOpponentNodeId: progress.battleOpponentNodeId,
      }
    })
    return accepted ? { accepted: true, ...(evolution ? { evolution } : {}) } : { accepted: false }
  },
})
