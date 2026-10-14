import type { DigimonNode } from "../../domain/digimon-node.ts"
import { resolveEvolutionBattle } from "../../domain/evolution.ts"
import type { Partner } from "../../domain/partner.ts"
import type { ResolveEvolutionBattleOutcome } from "../models/usage.ts"

export type EvolutionBattleRepository = {
  getEvolutionBattleId?: () => string | null
  completeEvolutionBattle?: (
    won: boolean,
    createdAt: string,
    expected?: EvolutionBattleExpectation,
    selector?: () => number,
  ) => ResolveEvolutionBattleOutcome
  getActivePartner: () => Partner | null
  resolveEvolutionBattle: (
    nextState: import("../../domain/partner.ts").PartnerProgression,
    createdAt: string,
  ) => ResolveEvolutionBattleOutcome
}

export type EvolutionBattleExpectation = Pick<
  Partner,
  "partnerId" | "currentNodeId" | "pendingEvolutionTargetId" | "battleOpponentNodeId"
> & { readonly battleId?: string | null }

export const resolveEvolutionBattleForPartner = (
  repository: EvolutionBattleRepository,
  won: boolean,
  digimonById: ReadonlyMap<string, DigimonNode>,
  createdAt: string,
  expected?: EvolutionBattleExpectation,
  selector: () => number = Math.random,
): ResolveEvolutionBattleOutcome => {
  if (repository.completeEvolutionBattle) return repository.completeEvolutionBattle(won, createdAt, expected, selector)
  const partner = repository.getActivePartner()
  if (partner === null) return { kind: "no_pending_battle" }
  if (
    expected &&
    (partner.partnerId !== expected.partnerId ||
      partner.currentNodeId !== expected.currentNodeId ||
      partner.pendingEvolutionTargetId !== expected.pendingEvolutionTargetId ||
      partner.battleOpponentNodeId !== expected.battleOpponentNodeId)
  )
    return { kind: "no_pending_battle" }

  const current = digimonById.get(partner.currentNodeId)
  if (current === undefined) {
    throw new Error(`Persisted partner node ${partner.currentNodeId} is missing from the catalog`)
  }

  if (partner.battleOpponentNodeId === null) {
    return { kind: "no_pending_battle" }
  }

  const next = resolveEvolutionBattle(
    {
      current,
      gauge: partner.gauge,
      isTerminal: partner.isTerminal,
      pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
      battleOpponentNodeId: partner.battleOpponentNodeId,
    },
    won,
    digimonById,
    0,
    selector,
  )

  return repository.resolveEvolutionBattle(
    {
      currentNodeId: next.current.id,
      gauge: next.gauge,
      isTerminal: next.isTerminal,
      pendingEvolutionTargetId: next.pendingEvolutionTargetId,
      battleOpponentNodeId: next.battleOpponentNodeId,
    },
    createdAt,
  )
}
