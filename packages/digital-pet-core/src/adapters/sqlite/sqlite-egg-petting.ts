import type { EggPettingStore } from "../../application/ports/egg-petting.ts"
import { IntlModule } from "../../i18n.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"
import { ACTIVE_PARTNER_SELECT, type PersistedPartnerRow, toPartner } from "./sqlite-digital-pet-schema.ts"

export const createSqliteEggPetting = (executor: SqliteExecutor): EggPettingStore => ({
  updateEgg: (partnerId, interactionId, createdAt, change) =>
    executor.transaction(() => {
      const row = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
      if (!row || row.partner_id !== partnerId) return false
      const eventId = `event-pet-egg-${interactionId}`
      if (executor.get<{ event_id: string }>("SELECT event_id FROM partner_events WHERE event_id = ?", [eventId]))
        return false
      const control = executor.get<{ frozen: number; cheat_node_id: string | null }>(
        "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
      )
      if (!control) throw new Error(IntlModule.translate("errors.missingControlState"))
      const next = change({
        partner: toPartner(row),
        frozen: control.frozen === 1,
        isSetOverride: control.cheat_node_id !== null,
      })
      if (!next) return false
      executor.run(
        "UPDATE partners SET current_node_id = ?, gauge = ?, is_terminal = ?, pending_evolution_target_id = ?, battle_opponent_node_id = ? WHERE partner_id = ?",
        [
          next.currentNodeId,
          next.gauge,
          next.isTerminal,
          next.pendingEvolutionTargetId,
          next.battleOpponentNodeId,
          partnerId,
        ],
      )
      executor.run(
        "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'usage_applied', ?, ?, ?, NULL, NULL, ?)",
        [eventId, partnerId, next.currentNodeId, next.gauge, next.isTerminal, createdAt],
      )
      return true
    }),
})
