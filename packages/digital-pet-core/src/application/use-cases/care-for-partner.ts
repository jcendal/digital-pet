import type { DigimonCatalog } from "../../domain/digimon-node.ts"
import { applyTokenProgress, type EvolutionSelector, type StageThresholds } from "../../domain/evolution.ts"
import { advanceHygiene, cleanHygiene, cleaningExperience } from "../../domain/hygiene.ts"
import type { PartnerHygiene, PartnerHygieneStore } from "../ports/partner-hygiene.ts"

export type PartnerHygieneService = {
  refreshHygiene(now: number): PartnerHygiene | undefined
  cleanPoop(partnerId: string, poopId: number, now: number): boolean
}

export const createPartnerHygieneService = (
  store: PartnerHygieneStore,
  catalog: DigimonCatalog,
  thresholds: StageThresholds,
  selector: EvolutionSelector = Math.random,
): PartnerHygieneService => ({
  refreshHygiene: (now) =>
    store.updateHygiene(({ partner, hygiene: previous, isSetOverride }) => {
      const node = catalog.byId.get(partner.currentNodeId)
      if (isSetOverride || !node?.stage) return undefined
      const hygiene = advanceHygiene(previous, false, now)
      return hygiene ? { hygiene } : undefined
    }),
  cleanPoop: (partnerId, poopId, now) =>
    Boolean(
      store.updateHygiene((snapshot) => {
        const { partner, frozen, isSetOverride } = snapshot
        const current = catalog.byId.get(partner.currentNodeId)
        if (
          partner.partnerId !== partnerId ||
          !current?.stage ||
          frozen ||
          isSetOverride ||
          partner.pendingEvolutionTargetId !== null
        )
          return undefined
        const hygiene = advanceHygiene(snapshot.hygiene, false, now)
        if (!hygiene) return undefined
        const next = cleanHygiene(hygiene, poopId, now)
        if (next === hygiene) return undefined
        const gauge = partner.isTerminal ? partner.gauge : cleaningExperience(partner.gauge, thresholds[current.stage])
        const progress = applyTokenProgress(
          {
            current,
            gauge: partner.gauge,
            isTerminal: partner.isTerminal,
            pendingEvolutionTargetId: null,
            battleOpponentNodeId: null,
          },
          gauge - partner.gauge,
          selector,
          catalog.byId,
          catalog.nodes,
          thresholds,
        )
        return {
          hygiene: next,
          progression: {
            currentNodeId: progress.current.id,
            gauge: progress.gauge,
            isTerminal: progress.isTerminal,
            pendingEvolutionTargetId: progress.pendingEvolutionTargetId,
            battleOpponentNodeId: progress.battleOpponentNodeId,
          },
          cleaned: { poopId, createdAt: new Date(now).toISOString() },
        }
      }),
    ),
})
