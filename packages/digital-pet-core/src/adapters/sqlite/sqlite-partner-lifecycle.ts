import type { SpawnPartnerInput } from "../../application/models/spawn-partner.ts"
import type { Partner } from "../../domain/partner.ts"
import { IntlModule } from "../../i18n.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"
import { ACTIVE_PARTNER_SELECT, type PersistedPartnerRow, toPartner } from "./sqlite-digital-pet-schema.ts"

/** Called inside the host transaction so retirement, history and the new generation commit together. */
export const spawnSqlitePartner = (executor: SqliteExecutor, input: SpawnPartnerInput): Partner => {
  executor.run("UPDATE vpet_control_state SET frozen = 0, cheat_node_id = NULL WHERE control_id = 1")
  const activePartnerRow = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
  if (activePartnerRow !== null) {
    const activePartner = toPartner(activePartnerRow)
    executor.run("UPDATE partners SET retired_at = ? WHERE partner_id = ?", [input.createdAt, activePartner.partnerId])
    executor.run(
      "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'retired', ?, ?, ?, NULL, NULL, ?)",
      [
        `event-retired-${activePartner.generation}`,
        activePartner.partnerId,
        activePartner.currentNodeId,
        activePartner.gauge,
        activePartner.isTerminal,
        input.createdAt,
      ],
    )
  }
  const generationRow = executor.get<{ readonly generation: number }>(
    "SELECT COALESCE(MAX(generation), 0) + 1 AS generation FROM partners",
  )
  if (generationRow === null) throw new Error(IntlModule.translate("errors.generationAllocationFailed"))
  const partnerId = `partner-${generationRow.generation}`
  executor.run(
    "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, pending_evolution_target_id, battle_opponent_node_id, created_at, retired_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL)",
    [partnerId, generationRow.generation, input.currentNodeId, input.gauge, input.isTerminal, input.createdAt],
  )
  executor.run(
    "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'spawned', ?, ?, ?, NULL, NULL, ?)",
    [
      `event-spawn-${generationRow.generation}`,
      partnerId,
      input.currentNodeId,
      input.gauge,
      input.isTerminal,
      input.createdAt,
    ],
  )
  return {
    partnerId,
    generation: generationRow.generation,
    ...input,
    pendingEvolutionTargetId: null,
    battleOpponentNodeId: null,
    retiredAt: null,
  }
}
