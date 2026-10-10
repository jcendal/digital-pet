import type { PartnerHygieneStore } from "../../application/ports/partner-hygiene.ts"
import { parseHygiene } from "../../domain/hygiene.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"
import { ACTIVE_PARTNER_SELECT, type PersistedPartnerRow, toPartner } from "./sqlite-digital-pet-schema.ts"

export const createSqlitePartnerHygiene = (executor: SqliteExecutor): PartnerHygieneStore => ({
  updateHygiene: (change) =>
    executor.transaction(() => {
      const row = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
      if (!row) return undefined
      const control = executor.get<{ frozen: number; cheat_node_id: string | null }>(
        "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
      )
      if (!control) throw new Error("Digital Pet control state row is missing")
      const stored = executor.get<{ state: string }>("SELECT state FROM partner_hygiene WHERE partner_id = ?", [
        row.partner_id,
      ])
      const hygiene = stored ? parseHygiene(JSON.parse(stored.state)) : undefined
      const partner = toPartner(row)
      const mutation = change({
        partner,
        frozen: control.frozen === 1,
        isSetOverride: control.cheat_node_id !== null,
        ...(hygiene ? { hygiene } : {}),
      })
      if (!mutation) return undefined
      if (mutation.hygiene !== hygiene)
        executor.run(
          "INSERT INTO partner_hygiene (partner_id, state) VALUES (?, ?) ON CONFLICT(partner_id) DO UPDATE SET state = excluded.state",
          [partner.partnerId, JSON.stringify(mutation.hygiene)],
        )
      const progress = mutation.progression
      if (progress)
        executor.run(
          "UPDATE partners SET current_node_id = ?, gauge = ?, is_terminal = ?, pending_evolution_target_id = ?, battle_opponent_node_id = ? WHERE partner_id = ?",
          [
            progress.currentNodeId,
            progress.gauge,
            progress.isTerminal,
            progress.pendingEvolutionTargetId,
            progress.battleOpponentNodeId,
            partner.partnerId,
          ],
        )
      if (mutation.cleaned)
        executor.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'usage_applied', ?, ?, ?, NULL, NULL, ?)",
          [
            `event-clean-${partner.partnerId}-${mutation.cleaned.poopId}`,
            partner.partnerId,
            progress?.currentNodeId ?? partner.currentNodeId,
            progress?.gauge ?? partner.gauge,
            progress?.isTerminal ?? partner.isTerminal,
            mutation.cleaned.createdAt,
          ],
        )
      return { partnerId: partner.partnerId, hygiene: mutation.hygiene }
    }),
})
