import { type AdventureCommand, type AdventureState, changeAdventure, endAdventure } from "../../domain/adventure.ts"
import { ADVENTURE_PACING } from "../../domain/adventure-pacing.ts"
import type { DigimonCatalog, DigimonNode } from "../../domain/digimon-node.ts"
import { applyTokenProgress } from "../../domain/evolution.ts"
import { advanceHygiene } from "../../domain/hygiene.ts"
import type { AdventureStore } from "../ports/adventure-store.ts"

export type AdventureService = {
  nextReadyAt(): Promise<number>
  act(command: AdventureCommand, now: number): Promise<AdventureState | undefined>
}
export const createAdventureService = (
  store: AdventureStore,
  catalog: DigimonCatalog,
  residentsFor: (regionId: string) => readonly DigimonNode[],
  random: () => number = Math.random,
  bossesFor: (regionId: string) => readonly DigimonNode[] = () => [],
  legacyBossesFor: (regionId: string) => readonly DigimonNode[] = () => [],
): AdventureService => ({
  async nextReadyAt() {
    return store.nextReadyAt()
  },
  async act(command, now) {
    return store.updateAdventure(({ partner, adventure, readyAt, blocked, thresholds, regionId, hygiene }) => {
      const current = catalog.byId.get(partner.currentNodeId)
      if (!current) return undefined
      if (command.adventureId !== undefined && command.adventureId !== adventure?.id) return undefined
      if (command.kind === "start" && now < readyAt) return undefined
      if (partner.pendingEvolutionTargetId && adventure?.status === "travel")
        return { adventure: endAdventure(adventure, now) }
      if (blocked && command.kind !== "pause" && command.kind !== "stop")
        return adventure ? { adventure: { ...adventure, running: false, lastTickAt: now } } : undefined
      const change = changeAdventure(
        adventure,
        command,
        current,
        regionId,
        residentsFor(adventure?.regionId ?? regionId),
        now,
        random,
        bossesFor(adventure?.regionId ?? regionId),
        legacyBossesFor(adventure?.regionId ?? regionId),
      )
      if (!change) return undefined
      if (change.recruitedNodeId) {
        const companion = catalog.byId.get(change.recruitedNodeId)
        if (!companion) return undefined
        return {
          adventure: change.adventure,
          replacement: {
            currentNodeId: companion.id,
            gauge: 0,
            isTerminal: companion.nextEvolutions.length === 0,
            createdAt: new Date(now).toISOString(),
          },
        }
      }
      const achievement = change.defeatedBossNodeId
        ? {
            bossVictory: {
              regionId: change.adventure.regionId,
              nodeId: change.defeatedBossNodeId,
              defeatedAt: new Date(now).toISOString(),
            },
          }
        : {}
      const cooldown = command.kind === "start" ? { readyAt: now + ADVENTURE_PACING.cooldownMs } : {}
      const fraction = change.experienceFraction
      if (!fraction || partner.isTerminal || partner.pendingEvolutionTargetId || blocked)
        return { adventure: change.adventure, ...cooldown, ...achievement }
      const progress = applyTokenProgress(
        {
          current,
          gauge: partner.gauge,
          isTerminal: partner.isTerminal,
          pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
          battleOpponentNodeId: partner.battleOpponentNodeId,
        },
        Math.ceil(thresholds[current.stage] * fraction),
        random,
        catalog.byId,
        catalog.nodes,
        thresholds,
        advanceHygiene(hygiene, current.stage === 0, now)?.poops.length ?? 0,
      )
      return {
        adventure:
          progress.pendingEvolutionTargetId || progress.current.id !== current.id
            ? endAdventure(change.adventure, now)
            : change.adventure,
        ...achievement,
        progression: {
          currentNodeId: progress.current.id,
          gauge: progress.gauge,
          isTerminal: progress.isTerminal,
          pendingEvolutionTargetId: progress.pendingEvolutionTargetId,
          battleOpponentNodeId: progress.battleOpponentNodeId,
        },
        rewardId: `${change.adventure.id}-${adventure?.event?.id}`,
      }
    })
  },
})
