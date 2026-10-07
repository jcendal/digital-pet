import { existsSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

import {
  ACTIVE_PARTNER_SELECT,
  ARCHIVE_PARTNER_EVENTS_SELECT,
  ARCHIVE_PARTNERS_SELECT,
  type PersistedPartnerEventRow,
  type PersistedPartnerRow,
  type TrainerStateRow,
  toPartner,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-schema.ts"
import { resolveHostDatabasePath } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
import type { DigitalPetArchiveResult } from "@jcendal/digital-pet-core/application/models/digital-pet-archive.ts"
import type { SidebarSnapshot } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"

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
    const row = database.prepare(ACTIVE_PARTNER_SELECT).get() as PersistedPartnerRow | undefined
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
    { kind: existsSync(databasePath) ? "unavailable" : "empty", message: "Digital Pet archive is unavailable." },
  )
