import type { ResolveEvolutionBattleOutcome } from "@jcendal/digital-pet-core/application/models/usage.ts"
import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import {
  type EvolutionBattleRepository,
  resolveEvolutionBattleForPartner,
} from "@jcendal/digital-pet-core/application/use-cases/resolve-evolution-battle.ts"
import type { DigimonCatalog } from "@jcendal/digital-pet-core/data/catalog.ts"
import type { MonsterFrameCatalog } from "@jcendal/digital-pet-core/data/monster-frame-catalog.ts"
import type { BattleFrameListener } from "../sequences/evolution-battle-artwork.ts"
import { presentEvolution } from "./evolution-presentation.ts"

import type { PresentationStateListener } from "./presentation-state.ts"

export type EvolutionBattleSessionDependencies = {
  readonly frameCatalog: MonsterFrameCatalog
  readonly digimonCatalog: DigimonCatalog
  readonly repository: EvolutionBattleRepository
  readonly random?: () => number
  readonly onState?: PresentationStateListener
  readonly onArtwork: BattleFrameListener
  readonly onResolved?: (result: ResolveEvolutionBattleOutcome) => Promise<void>
}

export const runEvolutionBattleSession = async (
  snapshot: SidebarSnapshot,
  viewportWidth: number,
  dependencies: EvolutionBattleSessionDependencies,
): Promise<boolean> => {
  if (snapshot.battleOpponentNodeId === null) return false

  const player = dependencies.digimonCatalog.byId.get(snapshot.currentNodeId)
  const opponent = dependencies.digimonCatalog.byId.get(snapshot.battleOpponentNodeId)
  if (player === undefined || opponent === undefined) return false
  const expected = dependencies.repository.getActivePartner()
  if (
    !expected ||
    expected.currentNodeId !== snapshot.currentNodeId ||
    expected.pendingEvolutionTargetId !== snapshot.pendingEvolutionTargetId ||
    expected.battleOpponentNodeId !== snapshot.battleOpponentNodeId
  )
    return false

  const battleId = dependencies.repository.getEvolutionBattleId?.()
  await presentEvolution(
    snapshot.currentNodeId,
    snapshot.pendingEvolutionTargetId,
    snapshot.battleOpponentNodeId,
    viewportWidth,
    {
      ...dependencies,
      resolveTarget: async (outcome) => {
        const result = resolveEvolutionBattleForPartner(
          dependencies.repository,
          outcome === "player",
          dependencies.digimonCatalog.byId,
          new Date().toISOString(),
          { ...expected, ...(battleId !== undefined ? { battleId } : {}) },
          dependencies.random,
        )
        await dependencies.onResolved?.(result)
        if (result.kind === "no_pending_battle") return undefined
        return result.kind === "won" ? result.evolution.toNodeId : null
      },
    },
  )
  return true
}
