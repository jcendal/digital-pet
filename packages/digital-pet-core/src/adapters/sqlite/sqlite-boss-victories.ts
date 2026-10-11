import type { BossVictory } from "../../domain/boss-victory.ts"

export const BOSS_VICTORIES_SELECT =
  "SELECT region_id, node_id, defeated_at FROM boss_victories ORDER BY region_id, node_id"
export type BossVictoryRow = { readonly region_id: string; readonly node_id: string; readonly defeated_at: string }
export const toBossVictory = (row: BossVictoryRow): BossVictory => ({
  regionId: row.region_id,
  nodeId: row.node_id,
  defeatedAt: row.defeated_at,
})
