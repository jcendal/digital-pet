import type { SpawnPartnerInput } from "../../application/models/spawn-partner.ts"
import type { ResolveEvolutionBattleOutcome, UsageReceiptMetadata } from "../../application/models/usage.ts"
import type { Partner, PartnerProgression } from "../../domain/partner.ts"
import { IntlModule } from "../../i18n.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"
import {
  ACTIVE_PARTNER_SELECT,
  PARTNER_BY_GENERATION_SELECT,
  PARTNER_EVENTS_SELECT,
  PARTNERS_SELECT,
  type PersistedPartnerEventRow,
  type PersistedPartnerRow,
  type TrainerStateRow,
  toPartner,
  toPersistedPartnerEvent,
  toUsageReceiptRecord,
  USAGE_RECEIPTS_SELECT,
  type UsageReceiptRow,
} from "./sqlite-digital-pet-schema.ts"
import type { SqliteDigitalPetWriteStore } from "./sqlite-digital-pet-types.ts"
import { readEvolutionCare } from "./sqlite-evolution-care.ts"
import { runMigrations } from "./sqlite-migrations.ts"
import { spawnSqlitePartner } from "./sqlite-partner-lifecycle.ts"
import { createSqlitePartnerTeamStore } from "./sqlite-partner-team-store.ts"

export type CreateSqliteDigitalPetWriteStoreOptions = {
  readonly databasePath: string
  readonly executor: SqliteExecutor
  readonly close: () => Promise<void> | void
}

type ControlStateRow = {
  readonly frozen: number
  readonly cheat_node_id: string | null
}

type ReceiptLedgerRow = {
  readonly receipt_key: string
}

export const createSqliteDigitalPetWriteStore = (
  options: CreateSqliteDigitalPetWriteStoreOptions,
): SqliteDigitalPetWriteStore => {
  const { databasePath, executor, close } = options
  const appliedMigrations = runMigrations(executor)

  const store = {
    ...createSqlitePartnerTeamStore(executor),
    databasePath,
    async close() {
      await close()
    },
    getAppliedMigrations() {
      return appliedMigrations
    },
    getTrainerState() {
      const trainerState = executor.get<TrainerStateRow>("SELECT total_tokens FROM trainer_state WHERE trainer_id = 1")
      if (trainerState === null) throw new Error(IntlModule.translate("errors.missingTrainerState"))
      return { totalTokens: trainerState.total_tokens }
    },
    getActivePartner() {
      const activePartner = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
      return activePartner === null ? null : toPartner(activePartner)
    },
    listPartners() {
      return executor.all<PersistedPartnerRow>(PARTNERS_SELECT).map(toPartner)
    },
    getPartnerByGeneration(generation: number) {
      const partner = executor.get<PersistedPartnerRow>(PARTNER_BY_GENERATION_SELECT, [generation])
      return partner === null ? null : toPartner(partner)
    },
    freeze() {
      return executor.transaction(() => {
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error(IntlModule.translate("errors.missingControlState"))
        if (controlState.frozen === 1) return { kind: "already_frozen" } as const
        executor.run("UPDATE vpet_control_state SET frozen = 1 WHERE control_id = 1")
        return { kind: "frozen" } as const
      })
    },
    unfreeze() {
      return executor.transaction(() => {
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error(IntlModule.translate("errors.missingControlState"))
        if (controlState.frozen === 0) return { kind: "already_unfrozen" } as const
        executor.run("UPDATE vpet_control_state SET frozen = 0 WHERE control_id = 1")
        return { kind: "unfrozen" } as const
      })
    },
    setCheatNode(cheatNodeId: string) {
      return executor.transaction(() => {
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error(IntlModule.translate("errors.missingControlState"))
        if (controlState.cheat_node_id === cheatNodeId) return { kind: "already_set", cheatNodeId } as const
        executor.run("UPDATE vpet_control_state SET cheat_node_id = ? WHERE control_id = 1", [cheatNodeId])
        return { kind: "set", cheatNodeId } as const
      })
    },
    spawnPartner(input: SpawnPartnerInput) {
      return executor.transaction(() => {
        return spawnSqlitePartner(executor, input)
      })
    },
    listPartnerEvents(partnerId: string) {
      return executor.all<PersistedPartnerEventRow>(PARTNER_EVENTS_SELECT, [partnerId]).map(toPersistedPartnerEvent)
    },
    applyUsageReceipt(
      metadata: UsageReceiptMetadata,
      evolve: (partner: Partner, uncleanPoops?: number) => PartnerProgression,
    ) {
      return executor.transaction(() => {
        const canonicalReceipt = executor.get<ReceiptLedgerRow>(
          "SELECT receipt_key FROM usage_receipts WHERE receipt_key = ? LIMIT 1",
          [metadata.receiptKey],
        )
        const controlReceipt = executor.get<ReceiptLedgerRow>(
          "SELECT receipt_key FROM vpet_control_receipts WHERE receipt_key = ? LIMIT 1",
          [metadata.receiptKey],
        )
        if (canonicalReceipt !== null || controlReceipt !== null) return { kind: "duplicate" } as const
        const controlState = executor.get<ControlStateRow>(
          "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
        )
        if (controlState === null) throw new Error(IntlModule.translate("errors.missingControlState"))
        if (controlState.cheat_node_id !== null) {
          executor.run(
            "INSERT INTO vpet_control_receipts (receipt_key, mode, token_delta, cost, created_at) VALUES (?, 'cheat', ?, ?, ?)",
            [metadata.receiptKey, metadata.tokenDelta, metadata.cost ?? null, metadata.createdAt],
          )
          return { kind: "applied" } as const
        }
        if (controlState.frozen === 1) {
          executor.run(
            "INSERT INTO vpet_control_receipts (receipt_key, mode, token_delta, cost, created_at) VALUES (?, 'frozen', ?, ?, ?)",
            [metadata.receiptKey, metadata.tokenDelta, metadata.cost ?? null, metadata.createdAt],
          )
          executor.run("UPDATE trainer_state SET total_tokens = total_tokens + ? WHERE trainer_id = 1", [
            metadata.tokenDelta,
          ])
          return { kind: "applied" } as const
        }
        const activePartnerRow = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
        if (activePartnerRow === null) return { kind: "no_active_partner" } as const
        const activePartner = toPartner(activePartnerRow)
        const nextState = evolve(activePartner, readEvolutionCare(executor, activePartner.partnerId, Date.now()))
        executor.run(
          "UPDATE partners SET current_node_id = ?, gauge = ?, is_terminal = ?, pending_evolution_target_id = ?, battle_opponent_node_id = ? WHERE partner_id = ?",
          [
            nextState.currentNodeId,
            nextState.gauge,
            nextState.isTerminal,
            nextState.pendingEvolutionTargetId,
            nextState.battleOpponentNodeId,
            activePartner.partnerId,
          ],
        )
        executor.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'usage_applied', ?, ?, ?, ?, ?, ?)",
          [
            metadata.eventId,
            activePartner.partnerId,
            nextState.currentNodeId,
            nextState.gauge,
            nextState.isTerminal,
            metadata.tokenDelta,
            metadata.receiptKey,
            metadata.createdAt,
          ],
        )
        executor.run(
          "INSERT INTO usage_receipts (receipt_key, partner_id, event_id, token_delta, cost, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [
            metadata.receiptKey,
            activePartner.partnerId,
            metadata.eventId,
            metadata.tokenDelta,
            metadata.cost ?? null,
            metadata.createdAt,
          ],
        )
        executor.run("UPDATE trainer_state SET total_tokens = total_tokens + ? WHERE trainer_id = 1", [
          metadata.tokenDelta,
        ])
        return { kind: "applied" } as const
      })
    },
    listUsageReceipts() {
      return executor.all<UsageReceiptRow>(USAGE_RECEIPTS_SELECT).map(toUsageReceiptRecord)
    },
    resolveEvolutionBattle(nextState: PartnerProgression, createdAt: string): ResolveEvolutionBattleOutcome {
      return executor.transaction(() => {
        const activePartnerRow = executor.get<PersistedPartnerRow>(ACTIVE_PARTNER_SELECT)
        if (activePartnerRow === null) return { kind: "no_pending_battle" } as const

        const activePartner = toPartner(activePartnerRow)
        if (activePartner.pendingEvolutionTargetId === null || activePartner.battleOpponentNodeId === null) {
          return { kind: "no_pending_battle" } as const
        }

        const fromNodeId = activePartner.currentNodeId
        executor.run(
          "UPDATE partners SET current_node_id = ?, gauge = ?, is_terminal = ?, pending_evolution_target_id = ?, battle_opponent_node_id = ? WHERE partner_id = ?",
          [
            nextState.currentNodeId,
            nextState.gauge,
            nextState.isTerminal,
            nextState.pendingEvolutionTargetId,
            nextState.battleOpponentNodeId,
            activePartner.partnerId,
          ],
        )
        executor.run(
          "INSERT INTO partner_events (event_id, partner_id, kind, current_node_id, gauge, is_terminal, token_delta, receipt_key, created_at) VALUES (?, ?, 'usage_applied', ?, ?, ?, NULL, NULL, ?)",
          [
            `event-battle-${createdAt}`,
            activePartner.partnerId,
            nextState.currentNodeId,
            nextState.gauge,
            nextState.isTerminal,
            createdAt,
          ],
        )

        if (nextState.currentNodeId !== fromNodeId) {
          return {
            kind: "won",
            evolution: { fromNodeId, toNodeId: nextState.currentNodeId },
          } as const
        }
        return { kind: "lost" } as const
      })
    },
  } satisfies SqliteDigitalPetWriteStore

  return store
}
