import type { Partner } from "./partner.ts"

export type TeamSlot = "principal" | "reserve"

export type PartnerTeam = {
  readonly revision: number
  readonly principal: Partner | null
  readonly reserve: Partner | null
}

type TeamExpectation = {
  readonly expectedRevision: number
  readonly expectedPrincipalId: string | null
  readonly expectedReserveId: string | null
}

export type TeamCommand = TeamExpectation &
  (
    | { readonly kind: "switch" }
    | {
        readonly kind: "place"
        readonly slot: TeamSlot
        readonly partner: Pick<Partner, "currentNodeId" | "gauge" | "isTerminal" | "createdAt">
      }
  )

export type TeamRejection = {
  readonly kind: "rejected"
  readonly reason: "stale" | "busy" | "empty_reserve" | "no_principal" | "invalid_input"
}
export type TeamCommandOutcome = TeamRejection | { readonly kind: "applied"; readonly team: PartnerTeam }

/** Evaluate against the snapshot inside the write transaction, never just a view's preview. */
export const rejectTeamCommand = (team: PartnerTeam, command: TeamCommand, blocked: boolean): TeamRejection | null => {
  if (
    command.expectedRevision !== team.revision ||
    command.expectedPrincipalId !== (team.principal?.partnerId ?? null) ||
    command.expectedReserveId !== (team.reserve?.partnerId ?? null)
  )
    return { kind: "rejected", reason: "stale" }
  if (blocked || team.principal?.pendingEvolutionTargetId || team.reserve?.pendingEvolutionTargetId)
    return { kind: "rejected", reason: "busy" }
  if (command.kind === "switch" && !team.reserve) return { kind: "rejected", reason: "empty_reserve" }
  if (command.kind === "switch" && !team.principal) return { kind: "rejected", reason: "no_principal" }
  if (command.kind === "place") {
    if (command.slot === "reserve" && !team.principal) return { kind: "rejected", reason: "no_principal" }
    if (
      !/^[0-7]-\d{3}$/.test(command.partner.currentNodeId) ||
      !Number.isSafeInteger(command.partner.gauge) ||
      command.partner.gauge < 0 ||
      !Number.isFinite(Date.parse(command.partner.createdAt))
    )
      return { kind: "rejected", reason: "invalid_input" }
  }
  return null
}
