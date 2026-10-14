import type { AdventureStore } from "../../application/ports/adventure-store.ts"
import { parseAdventure } from "../../domain/adventure.ts"
import { limitAdventureReadyAt } from "../../domain/adventure-pacing.ts"
import { STAGE_GAUGE_THRESHOLDS } from "../../domain/evolution.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"
import { ACTIVE_PARTNER_SELECT, type PersistedPartnerRow, toPartner } from "./sqlite-digital-pet-schema.ts"
import { readEvolutionHygiene } from "./sqlite-evolution-care.ts"
import { spawnSqlitePartner } from "./sqlite-partner-lifecycle.ts"

const readReadyAt = (executor: SqliteExecutor): number => {
  const saved =
    executor.get<{ ready_at: number }>("SELECT ready_at FROM adventure_schedule WHERE schedule_id = 1")?.ready_at ?? 0
  const readyAt = limitAdventureReadyAt(saved, Date.now())
  if (readyAt !== saved) executor.run("UPDATE adventure_schedule SET ready_at = ? WHERE schedule_id = 1", [readyAt])
  return readyAt
}

export const createSqliteAdventureStore = (executor: SqliteExecutor, regionId: string): AdventureStore => ({
  nextReadyAt: () => executor.transaction(() => readReadyAt(executor)),
  updateAdventure: (change) =>
    executor.transaction(() => {
      const row = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
      if (!row) return undefined
      const control = executor.get<{ frozen: number; cheat_node_id: string | null }>(
        "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
      )
      const saved = executor.get<{ state: string }>("SELECT state FROM partner_adventures WHERE partner_id = ?", [
        row.partner_id,
      ])
      const adventure = saved ? parseAdventure(JSON.parse(saved.state)) : undefined
      const next = change({
        partner: toPartner(row),
        adventure,
        readyAt: readReadyAt(executor),
        blocked:
          !control ||
          control.frozen === 1 ||
          control.cheat_node_id !== null ||
          row.pending_evolution_target_id !== null,
        thresholds: STAGE_GAUGE_THRESHOLDS,
        regionId,
        hygiene: readEvolutionHygiene(executor, row.partner_id),
      })
      if (!next) return undefined
      if (next.adventure !== adventure)
        executor.run(
          "INSERT INTO partner_adventures (partner_id, state) VALUES (?, ?) ON CONFLICT(partner_id) DO UPDATE SET state = excluded.state",
          [row.partner_id, JSON.stringify(next.adventure)],
        )
      if (next.readyAt !== undefined)
        executor.run(
          "INSERT INTO adventure_schedule (schedule_id, ready_at) VALUES (1, ?) ON CONFLICT(schedule_id) DO UPDATE SET ready_at = excluded.ready_at",
          [next.readyAt],
        )
      if (next.bossVictory)
        executor.run(
          "INSERT INTO boss_victories (region_id, node_id, defeated_at) VALUES (?, ?, ?) ON CONFLICT(region_id, node_id) DO NOTHING",
          [next.bossVictory.regionId, next.bossVictory.nodeId, next.bossVictory.defeatedAt],
        )
      if (next.replacement) spawnSqlitePartner(executor, next.replacement)
      const progress = next.progression
      if (progress) {
        executor.run(
          "UPDATE partners SET current_node_id = ?, gauge = ?, is_terminal = ?, pending_evolution_target_id = ?, battle_opponent_node_id = ? WHERE partner_id = ?",
          [
            progress.currentNodeId,
            progress.gauge,
            progress.isTerminal,
            progress.pendingEvolutionTargetId,
            progress.battleOpponentNodeId,
            row.partner_id,
          ],
        )
        executor.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'usage_applied', ?, ?, ?, NULL, NULL, ?)",
          [
            `event-adventure-${next.rewardId}`,
            row.partner_id,
            progress.currentNodeId,
            progress.gauge,
            progress.isTerminal,
            new Date().toISOString(),
          ],
        )
      }
      return next.adventure
    }),
})
