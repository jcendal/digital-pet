import type { PartnerTeam, TeamCommand, TeamCommandOutcome } from "../../domain/partner-team.ts"

export type PartnerTeamStore = {
  readonly readTeam: () => PartnerTeam
  readonly applyTeamCommand: (command: TeamCommand, now: number) => TeamCommandOutcome
}
