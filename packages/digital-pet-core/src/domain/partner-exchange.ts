import type { Partner } from "./partner.ts"

/** Exchange eligibility applies to every host, independently of transport or animation. */
export const canExchangePartner = (
  partner: Pick<Partner, "currentNodeId" | "pendingEvolutionTargetId" | "battleOpponentNodeId">,
  stage: number,
  busy: boolean,
): boolean => stage > 0 && !busy && !partner.pendingEvolutionTargetId && !partner.battleOpponentNodeId

export const exchangeJourney = (nodeId: string, now: number) => {
  const createdAt = new Date(now).toISOString()
  return { createdAt, events: [{ currentNodeId: nodeId, createdAt }] }
}
