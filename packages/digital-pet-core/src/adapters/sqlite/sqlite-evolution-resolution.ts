import type { ResolveEvolutionBattleOutcome } from "../../application/models/usage.ts"
import type { EvolutionBattleExpectation } from "../../application/use-cases/resolve-evolution-battle.ts"
import { DIGIMON_CATALOG } from "../../data/catalog.ts"
import { resolveEvolutionBattle } from "../../domain/evolution.ts"
import type { Partner, PartnerProgression } from "../../domain/partner.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"
import { readCombatProgress, syncCombatProgress } from "./sqlite-combat-progress.ts"
import { ACTIVE_PARTNER_SELECT, type PersistedPartnerRow, toPartner } from "./sqlite-digital-pet-schema.ts"
import { readEvolutionCare } from "./sqlite-evolution-care.ts"

export const createSqliteEvolutionBattleStore = (executor: SqliteExecutor) => {
  const active = () => {
    const row = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
    return row ? toPartner(row) : null
  }
  const commit = (partner: Partner, next: PartnerProgression, createdAt: string): ResolveEvolutionBattleOutcome => {
    executor.run(
      "UPDATE partners SET current_node_id = ?, gauge = ?, is_terminal = ?, pending_evolution_target_id = ?, battle_opponent_node_id = ? WHERE partner_id = ?",
      [
        next.currentNodeId,
        next.gauge,
        next.isTerminal,
        next.pendingEvolutionTargetId,
        next.battleOpponentNodeId,
        partner.partnerId,
      ],
    )
    syncCombatProgress(executor, partner.partnerId, next)
    executor.run(
      "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'usage_applied', ?, ?, ?, NULL, NULL, ?)",
      [
        `event-battle-${partner.partnerId}-${createdAt}`,
        partner.partnerId,
        next.currentNodeId,
        next.gauge,
        next.isTerminal,
        createdAt,
      ],
    )
    return next.currentNodeId !== partner.currentNodeId
      ? { kind: "won", evolution: { fromNodeId: partner.currentNodeId, toNodeId: next.currentNodeId } }
      : { kind: "lost" }
  }
  return {
    getEvolutionBattleId: (): string | null => {
      const partner = active()
      return partner ? readCombatProgress(executor, partner.partnerId, partner.currentNodeId).battle_id : null
    },
    resolveEvolutionBattle: (next: PartnerProgression, createdAt: string): ResolveEvolutionBattleOutcome =>
      executor.transaction(() => {
        const partner = active()
        return partner?.battleOpponentNodeId ? commit(partner, next, createdAt) : { kind: "no_pending_battle" }
      }),
    completeEvolutionBattle: (
      won: boolean,
      createdAt: string,
      expected?: EvolutionBattleExpectation,
      selector: () => number = Math.random,
    ): ResolveEvolutionBattleOutcome =>
      executor.transaction(() => {
        const partner = active()
        if (!partner?.battleOpponentNodeId) return { kind: "no_pending_battle" }
        const progress = readCombatProgress(executor, partner.partnerId, partner.currentNodeId)
        if (
          expected &&
          (partner.partnerId !== expected.partnerId ||
            partner.currentNodeId !== expected.currentNodeId ||
            partner.pendingEvolutionTargetId !== expected.pendingEvolutionTargetId ||
            partner.battleOpponentNodeId !== expected.battleOpponentNodeId ||
            (expected.battleId !== undefined && progress.battle_id !== expected.battleId))
        )
          return { kind: "no_pending_battle" }
        const current = DIGIMON_CATALOG.byId.get(partner.currentNodeId)
        if (!current) throw new Error("Unknown evolution participant")
        const next = resolveEvolutionBattle(
          {
            current,
            gauge: partner.gauge,
            isTerminal: partner.isTerminal,
            pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
            battleOpponentNodeId: partner.battleOpponentNodeId,
            combatVictories: progress.victories,
          },
          won,
          DIGIMON_CATALOG.byId,
          readEvolutionCare(executor, partner.partnerId, Date.parse(createdAt)),
          selector,
        )
        const result = commit(
          partner,
          {
            currentNodeId: next.current.id,
            gauge: next.gauge,
            isTerminal: next.isTerminal,
            pendingEvolutionTargetId: null,
            battleOpponentNodeId: null,
          },
          createdAt,
        )
        executor.run("UPDATE partner_combat_progress SET victories = ? WHERE partner_id = ?", [
          next.combatVictories ?? 0,
          partner.partnerId,
        ])
        return won && next.current.id === current.id ? { kind: "won_without_evolution" } : result
      }),
  }
}
