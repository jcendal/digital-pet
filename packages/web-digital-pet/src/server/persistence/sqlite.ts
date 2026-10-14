import { existsSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { resolveHostDatabasePath } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
import {
  BOSS_VICTORIES_SELECT,
  type BossVictoryRow,
  toBossVictory,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-boss-victories.ts"
import {
  ACTIVE_PARTNER_SELECT,
  ARCHIVE_PARTNER_EVENTS_SELECT,
  ARCHIVE_PARTNERS_SELECT,
  LEGACY_ACTIVE_PARTNER_SELECT,
  type PersistedPartnerEventRow,
  type PersistedPartnerRow,
  type TrainerStateRow,
  toPartner,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-schema.ts"
import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import type { BossVictory } from "@jcendal/digital-pet-core/domain/boss-victory.ts"
import { IntlModule } from "../../shared/i18n.ts"

export const databasePath = process.env.DIGITAL_PET_DATABASE_PATH || resolveHostDatabasePath()
export const hasHostDatabase = (): boolean => existsSync(databasePath)

const readDatabase = <T>(read: (database: DatabaseSync) => T, fallback: T): T => {
  if (!existsSync(databasePath)) return fallback
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    return read(database)
  } catch (error) {
    if (error instanceof Error && /sqlite|database|no such table/i.test(error.message)) return fallback
    throw error
  } finally {
    database.close()
  }
}

export const readSidebarSnapshot = (): SidebarSnapshot | null =>
  readDatabase((database) => {
    const trainer = database.prepare("SELECT total_tokens FROM trainer_state WHERE trainer_id = 1").get() as
      | TrainerStateRow
      | undefined
    const control = database
      .prepare("SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1")
      .get() as { frozen: number; cheat_node_id: string | null } | undefined
    if (control?.cheat_node_id) {
      return {
        currentNodeId: control.cheat_node_id,
        gauge: 0,
        isTerminal: true,
        frozen: false,
        isSetOverride: true,
        trainerTotalTokens: trainer?.total_tokens ?? 0,
        pendingEvolutionTargetId: null,
        battleOpponentNodeId: null,
      }
    }
    const migrated = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'partner_team'")
      .get()
    const row = database.prepare(migrated ? ACTIVE_PARTNER_SELECT : LEGACY_ACTIVE_PARTNER_SELECT).get() as
      | PersistedPartnerRow
      | undefined
    if (row === undefined) return null
    const partner = toPartner(row)
    return {
      currentNodeId: partner.currentNodeId,
      gauge: partner.gauge,
      isTerminal: partner.isTerminal,
      frozen: control?.frozen === 1,
      isSetOverride: false,
      trainerTotalTokens: trainer?.total_tokens ?? 0,
      pendingEvolutionTargetId: partner.pendingEvolutionTargetId,
      battleOpponentNodeId: partner.battleOpponentNodeId,
    }
  }, null)

export const readArchive = (): DigitalPetArchiveResult =>
  readDatabase<DigitalPetArchiveResult>(
    (database) => {
      const partners = database.prepare(ARCHIVE_PARTNERS_SELECT).all() as PersistedPartnerRow[]
      if (partners.length === 0) return { kind: "empty" }
      const events = database.prepare(ARCHIVE_PARTNER_EVENTS_SELECT).all() as PersistedPartnerEventRow[]
      const eventsByPartner = new Map<string, { eventId: string; currentNodeId: string; createdAt: string }[]>()
      for (const event of events) {
        const list = eventsByPartner.get(event.partner_id) ?? []
        list.push({ eventId: event.event_id, currentNodeId: event.current_node_id, createdAt: event.created_at })
        eventsByPartner.set(event.partner_id, list)
      }
      return {
        kind: "available",
        partners: partners.map((partner) => ({
          partnerId: partner.partner_id,
          generation: partner.generation,
          createdAt: partner.created_at,
          retiredAt: partner.retired_at,
          events: eventsByPartner.get(partner.partner_id) ?? [],
        })),
      }
    },
    {
      kind: existsSync(databasePath) ? "unavailable" : "empty",
      message: IntlModule.translate("sqlite.digitalPetArchiveIsUnavailable"),
    },
  )

export const readBossVictories = (): readonly BossVictory[] =>
  readDatabase((database) => (database.prepare(BOSS_VICTORIES_SELECT).all() as BossVictoryRow[]).map(toBossVictory), [])

/** Read legacy saves without migrating or writing the host database. */
export const readTeam = (): import("@jcendal/digital-pet-core/domain/partner-team.ts").PartnerTeam =>
  readDatabase(
    (database) => {
      const exists = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'partner_team'")
        .get()
      if (!exists) {
        const principal = database.prepare(LEGACY_ACTIVE_PARTNER_SELECT).get() as PersistedPartnerRow | undefined
        return { revision: 0, principal: principal ? toPartner(principal) : null, reserve: null }
      }
      const team = database
        .prepare("SELECT revision, principal_id, reserve_id FROM partner_team WHERE team_id = 1")
        .get() as { revision: number; principal_id: string | null; reserve_id: string | null } | undefined
      const member = (id: string | null | undefined) => {
        const row = id
          ? (database.prepare("SELECT * FROM partners WHERE partner_id = ? AND retired_at IS NULL").get(id) as
              | PersistedPartnerRow
              | undefined)
          : undefined
        return row ? toPartner(row) : null
      }
      return { revision: team?.revision ?? 0, principal: member(team?.principal_id), reserve: member(team?.reserve_id) }
    },
    { revision: 0, principal: null, reserve: null },
  )
