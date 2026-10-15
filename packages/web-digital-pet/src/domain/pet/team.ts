import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { resumePartnerHygiene } from "@jcendal/digital-pet-core/domain/partner-rest.ts"
import {
  type PartnerTeam,
  rejectTeamCommand,
  type TeamCommand,
  type TeamCommandOutcome,
} from "@jcendal/digital-pet-core/domain/partner-team.ts"
import type { LocalPartnerState, LocalPetState } from "./progress.ts"
import { advanceLocalPet, replaceLocalPartner } from "./progress.ts"

export const localPartner = (state: LocalPartnerState) => ({
  ...state,
  generation: 0,
  retiredAt: null,
  pendingEvolutionTargetId: state.pendingEvolution?.targetNodeId ?? null,
  battleOpponentNodeId: state.pendingEvolution?.opponentNodeId ?? null,
})

export const localTeam = (state: LocalPetState): PartnerTeam => ({
  revision: state.teamRevision ?? 0,
  principal: localPartner(state),
  reserve: state.reserve ? localPartner(state.reserve) : null,
})

/** The reserve stores only its own state, never a nested team or trainer-wide unlocks. */
export const partnerState = (state: LocalPartnerState): LocalPartnerState => ({
  partnerId: state.partnerId,
  createdAt: state.createdAt,
  currentNodeId: state.currentNodeId,
  gauge: state.gauge,
  isTerminal: state.isTerminal,
  lastTickAt: state.lastTickAt,
  events: state.events,
  combatVictories: state.combatVictories ?? 0,
  adventureReadyAt: state.adventureReadyAt ?? 0,
  ...(state.originEggId ? { originEggId: state.originEggId } : {}),
  ...(state.food ? { food: state.food } : {}),
  ...(state.hygiene ? { hygiene: state.hygiene } : {}),
  ...(state.pendingEvolution ? { pendingEvolution: state.pendingEvolution } : {}),
})

export const applyLocalTeamCommand = (
  initial: LocalPetState,
  command: TeamCommand,
  newPartnerId: string,
  now: number,
  blocked: boolean,
): { readonly state: LocalPetState; readonly outcome: TeamCommandOutcome } => {
  const reject = (reason: "invalid_input") => ({ state: initial, outcome: { kind: "rejected", reason } as const })
  if (!Number.isSafeInteger(now) || now < 0) return reject("invalid_input")
  const rejection = rejectTeamCommand(localTeam(initial), command, blocked)
  if (rejection) return { state: initial, outcome: rejection }
  if (
    command.kind === "place" &&
    (!DIGIMON_CATALOG.byId.has(command.partner.currentNodeId) ||
      !newPartnerId ||
      newPartnerId === initial.partnerId ||
      newPartnerId === initial.reserve?.partnerId ||
      initial.retiredPartners?.some((partner) => partner.partnerId === newPartnerId))
  )
    return reject("invalid_input")
  if (initial.reserve && now < initial.reserve.pausedAt) return reject("invalid_input")
  const settled = advanceLocalPet(initial, now)
  const busy = rejectTeamCommand(localTeam(settled), command, false)
  if (busy) return { state: settled, outcome: busy }
  const revision = (settled.teamRevision ?? 0) + 1
  let next: LocalPetState
  if (command.kind === "place") {
    if (command.slot === "principal") {
      next = {
        ...replaceLocalPartner(settled, newPartnerId, now, command.partner.currentNodeId, command.partner.isTerminal),
        combatVictories: 0,
        gauge: command.partner.gauge,
        teamRevision: revision,
      }
    } else {
      const createdAt = new Date(now).toISOString()
      next = {
        ...settled,
        teamRevision: revision,
        reserve: {
          partnerId: newPartnerId,
          createdAt,
          currentNodeId: command.partner.currentNodeId,
          combatVictories: 0,
          adventureReadyAt: 0,
          gauge: command.partner.gauge,
          isTerminal: command.partner.isTerminal,
          lastTickAt: now,
          pausedAt: now,
          events: [{ currentNodeId: command.partner.currentNodeId, createdAt }],
        },
        retiredPartners: [
          ...(settled.retiredPartners ?? []),
          ...(settled.reserve
            ? [
                {
                  partnerId: settled.reserve.partnerId,
                  createdAt: settled.reserve.createdAt,
                  retiredAt: createdAt,
                  events: settled.reserve.events,
                },
              ]
            : []),
        ],
      }
    }
  } else {
    const reserve = settled.reserve
    if (!reserve) throw new Error("Missing reserve companion")
    const {
      reserve: _reserve,
      food: _food,
      hygiene: _hygiene,
      pendingEvolution: _pending,
      originEggId: _origin,
      ...global
    } = settled
    const resumed = partnerState(reserve)
    const shift = Math.max(0, now - reserve.pausedAt)
    next = {
      ...global,
      ...resumed,
      lastTickAt: resumed.lastTickAt + shift,
      teamRevision: revision,
      ...(reserve.hygiene ? { hygiene: resumePartnerHygiene(reserve.hygiene, reserve.pausedAt, now) } : {}),
      ...(reserve.food?.kind === "scheduled"
        ? { food: { kind: "scheduled", availableAt: now + Math.max(0, reserve.food.availableAt - reserve.pausedAt) } }
        : {}),
      reserve: { ...partnerState(settled), pausedAt: now },
    }
  }
  return { state: next, outcome: { kind: "applied", team: localTeam(next) } }
}
