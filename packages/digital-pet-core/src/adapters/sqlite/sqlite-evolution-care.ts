import { advanceHygiene, type HygieneState, parseHygiene } from "../../domain/hygiene.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"

export const readEvolutionHygiene = (executor: SqliteExecutor, partnerId: string): HygieneState | undefined => {
  const saved = executor.get<{ state: string }>("SELECT state FROM partner_hygiene WHERE partner_id = ?", [partnerId])
  return saved ? parseHygiene(JSON.parse(saved.state)) : undefined
}

export const readEvolutionCare = (executor: SqliteExecutor, partnerId: string, now: number): number =>
  advanceHygiene(readEvolutionHygiene(executor, partnerId), false, now)?.poops.length ?? 0
