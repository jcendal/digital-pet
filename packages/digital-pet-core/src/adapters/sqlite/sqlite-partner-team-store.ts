import type { PartnerTeamStore } from "../../application/ports/partner-team-store.ts"
import { DIGIMON_CATALOG } from "../../data/catalog.ts"
import { type AdventureState, adventureBusy, parseAdventure } from "../../domain/adventure.ts"
import { advanceHygiene } from "../../domain/hygiene.ts"
import { resumePartnerHygiene } from "../../domain/partner-rest.ts"
import { type PartnerTeam, rejectTeamCommand } from "../../domain/partner-team.ts"
import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"
import { type PersistedPartnerRow, toPartner } from "./sqlite-digital-pet-schema.ts"
import { readEvolutionHygiene } from "./sqlite-evolution-care.ts"
import { spawnSqlitePartner } from "./sqlite-partner-lifecycle.ts"

type TeamRow = {
  readonly principal_id: string | null
  readonly reserve_id: string | null
  readonly reserve_paused_at: number | null
  readonly revision: number
}

const readRow = (executor: SqliteExecutor): TeamRow => {
  const row = executor.get<TeamRow>(
    "SELECT principal_id, reserve_id, reserve_paused_at, revision FROM partner_team WHERE team_id = 1",
  )
  if (!row) throw new Error("Missing partner team")
  return row
}

const readTeam = (executor: SqliteExecutor, row = readRow(executor)): PartnerTeam => {
  const read = (id: string | null) => {
    const partner = id
      ? executor.get<PersistedPartnerRow>("SELECT * FROM partners WHERE partner_id = ? AND retired_at IS NULL", [id])
      : null
    return partner ? toPartner(partner) : null
  }
  return { revision: row.revision, principal: read(row.principal_id), reserve: read(row.reserve_id) }
}

const readAdventure = (executor: SqliteExecutor, partnerId: string | undefined): AdventureState | undefined => {
  if (!partnerId) return undefined
  const row = executor.get<{ state: string }>("SELECT state FROM partner_adventures WHERE partner_id = ?", [partnerId])
  return row ? parseAdventure(JSON.parse(row.state)) : undefined
}

export const createSqlitePartnerTeamStore = (executor: SqliteExecutor): PartnerTeamStore => ({
  readTeam: () => executor.transaction(() => readTeam(executor)),
  applyTeamCommand: (command, now) =>
    executor.transaction(() => {
      if (!Number.isSafeInteger(now) || now < 0) return { kind: "rejected", reason: "invalid_input" }
      const row = readRow(executor)
      const team = readTeam(executor, row)
      const control = executor.get<{ frozen: number; cheat_node_id: string | null }>(
        "SELECT frozen, cheat_node_id FROM vpet_control_state WHERE control_id = 1",
      )
      const blocked =
        !control ||
        control.frozen === 1 ||
        control.cheat_node_id !== null ||
        adventureBusy(readAdventure(executor, team.principal?.partnerId)) ||
        adventureBusy(readAdventure(executor, team.reserve?.partnerId))
      const rejection = rejectTeamCommand(team, command, blocked)
      if (rejection) return rejection
      if (command.kind === "place") {
        if (!DIGIMON_CATALOG.byId.has(command.partner.currentNodeId))
          return { kind: "rejected", reason: "invalid_input" }
        spawnSqlitePartner(executor, { ...command.partner, createdAt: new Date(now).toISOString() }, command.slot)
      } else {
        const principal = team.principal
        const reserve = team.reserve
        if (!principal || !reserve || row.reserve_paused_at === null)
          throw new Error("Cannot switch an incomplete team")
        const pausedAt = row.reserve_paused_at
        if (now < pausedAt) return { kind: "rejected", reason: "invalid_input" }
        const current = DIGIMON_CATALOG.byId.get(principal.currentNodeId)
        if (!current) throw new Error("Unknown principal companion")
        const hygiene = advanceHygiene(readEvolutionHygiene(executor, principal.partnerId), current.stage === 0, now)
        if (hygiene)
          executor.run(
            "INSERT INTO partner_hygiene (partner_id, state) VALUES (?, ?) ON CONFLICT(partner_id) DO UPDATE SET state = excluded.state",
            [principal.partnerId, JSON.stringify(hygiene)],
          )
        const restingHygiene = readEvolutionHygiene(executor, reserve.partnerId)
        if (restingHygiene)
          executor.run("UPDATE partner_hygiene SET state = ? WHERE partner_id = ?", [
            JSON.stringify(resumePartnerHygiene(restingHygiene, pausedAt, now)),
            reserve.partnerId,
          ])
        const restingAdventure = readAdventure(executor, reserve.partnerId)
        if (restingAdventure)
          executor.run("UPDATE partner_adventures SET state = ? WHERE partner_id = ?", [
            JSON.stringify({ ...restingAdventure, lastTickAt: now }),
            reserve.partnerId,
          ])
        executor.run(
          "UPDATE partner_team SET principal_id = ?, reserve_id = ?, reserve_paused_at = ?, revision = revision + 1 WHERE team_id = 1",
          [reserve.partnerId, principal.partnerId, now],
        )
      }
      return { kind: "applied", team: readTeam(executor) }
    }),
})
