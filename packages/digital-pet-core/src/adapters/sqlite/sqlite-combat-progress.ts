import type { PartnerProgression } from "../../domain/partner.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"

export const readCombatProgress = (executor: Pick<SqliteExecutor, "get">, partnerId: string, nodeId: string) =>
  executor.get<{ victories: number; battle_id: string | null }>(
    "SELECT victories, battle_id FROM partner_combat_progress WHERE partner_id = ? AND node_id = ?",
    [partnerId, nodeId],
  ) ?? { victories: 0, battle_id: null }

/** Called within the same transaction that opens/closes a duel or changes form. */
export const syncCombatProgress = (executor: SqliteExecutor, partnerId: string, progress: PartnerProgression): void => {
  const previous = readCombatProgress(executor, partnerId, progress.currentNodeId)
  const battleId = progress.battleOpponentNodeId
    ? (previous.battle_id ?? executor.get<{ id: string }>("SELECT lower(hex(randomblob(16))) AS id")?.id ?? null)
    : null
  executor.run(
    "INSERT INTO partner_combat_progress (partner_id, node_id, victories, battle_id) VALUES (?, ?, ?, ?) ON CONFLICT(partner_id) DO UPDATE SET node_id = excluded.node_id, victories = excluded.victories, battle_id = excluded.battle_id",
    [partnerId, progress.currentNodeId, previous.victories, battleId],
  )
}

export const addCombatVictory = (executor: SqliteExecutor, partnerId: string, nodeId: string): void => {
  executor.run(
    "INSERT INTO partner_combat_progress (partner_id, node_id, victories, battle_id) VALUES (?, ?, 1, NULL) ON CONFLICT(partner_id) DO UPDATE SET victories = CASE WHEN node_id = excluded.node_id THEN min(victories + 1, 1000000) ELSE 1 END, node_id = excluded.node_id",
    [partnerId, nodeId],
  )
}
