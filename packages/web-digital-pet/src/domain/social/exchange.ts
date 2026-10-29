import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { canExchangePartner, exchangeJourney } from "@jcendal/digital-pet-core/domain/partner-exchange.ts"
import type { LocalPartnerState, LocalPetState } from "../pet/progress.ts"
import { localPartner, partnerState } from "../pet/team.ts"
import type { Offer } from "./model.ts"

export const exchangeOffer = (state: LocalPetState, slot: Offer["slot"], busy: boolean): Offer => {
  const partner = slot === "principal" ? state : state.reserve
  if (
    !partner ||
    !canExchangePartner(localPartner(partner), DIGIMON_CATALOG.byId.get(partner.currentNodeId)?.stage ?? 0, busy)
  )
    throw new Error("social.busy")
  return { slot, revision: state.teamRevision ?? 0, partner: partnerState(partner) }
}
export const offerMatches = (state: LocalPetState, offer: Offer): boolean => {
  const partner = offer.slot === "principal" ? state : state.reserve
  return Boolean(
    partner &&
      (state.teamRevision ?? 0) === offer.revision &&
      JSON.stringify(partnerState(partner)) === JSON.stringify(offer.partner),
  )
}
/** Close only the sender's local journey; trainer unlocks and the other slot stay local. */
export const applyExchange = (
  state: LocalPetState,
  local: Offer,
  remote: Offer,
  newId: string,
  now: number,
): LocalPetState => {
  if (!offerMatches(state, local)) throw new Error("social.stale")
  const source = remote.partner
  const incoming: LocalPartnerState = {
    ...source,
    ...exchangeJourney(source.currentNodeId, now),
    partnerId: newId,
    lastTickAt: now,
  }
  const retiredPartners = [
    ...(state.retiredPartners ?? []),
    {
      partnerId: local.partner.partnerId,
      createdAt: local.partner.createdAt,
      retiredAt: new Date(now).toISOString(),
      events: local.partner.events,
    },
  ]
  const global = { ...state, retiredPartners, teamRevision: (state.teamRevision ?? 0) + 1 }
  if (local.slot === "reserve") return { ...global, reserve: { ...incoming, pausedAt: now } }
  const { food: _food, hygiene: _hygiene, pendingEvolution: _pending, originEggId: _origin, ...rest } = global
  return { ...rest, ...incoming }
}
