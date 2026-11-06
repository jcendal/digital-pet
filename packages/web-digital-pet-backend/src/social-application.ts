import { boundedText, destinationOf, identifier, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import type { SocialCommand } from "@jcendal/digital-pet-online/social-commands.ts"
import { parseOffer } from "@jcendal/web-digital-pet/protocol/social"
import type { Accounts } from "./accounts.ts"
import { numberOf, operationId } from "./input.ts"
import type { RealtimeService } from "./realtime.ts"
import type { SocialService } from "./social.ts"
import type { SocketRequests } from "./socket-requests.ts"

export type SocialServices = {
  accounts: Accounts
  social: SocialService
  realtime: RealtimeService
  requests?: SocketRequests
}

/** Authenticated application operations shared by HTTP and WebSocket adapters. */
export const executeSocial = async (
  services: SocialServices,
  actor: string,
  command: SocialCommand,
): Promise<unknown> => {
  const body = command.input
  switch (command.type) {
    case "profile.read":
      return services.accounts.ensure(actor)
    case "profile.rename":
      return services.accounts.rename(actor, boundedText(body.alias, 24))
    case "profile.publish":
      return services.accounts.presence(actor, body.profile)
    case "profile.lookup":
      return services.accounts.find(boundedText(body.code, 16))
    case "inbox.read": {
      const page = await services.social.inbox(actor, typeof body.after === "string" ? body.after : "")
      const ids = [...new Set(page.relationships.flatMap((pair) => pair.value.members))].filter((id) => id !== actor)
      const profiles = await Promise.all(ids.map((id) => services.accounts.ensure(id)))
      const online = (
        await Promise.all(ids.map(async (id) => ((await services.realtime.online(id)) ? id : null)))
      ).filter((id) => id !== null)
      return { ...page, profiles, online }
    }
    case "battle.decide":
      return services.realtime.battleDecision(
        actor,
        identifier(body.channel),
        destinationOf(body.destination),
        body.digest === undefined ? undefined : boundedText(body.digest, 64),
      )
    case "invitation.send": {
      const recipient = await services.accounts.find(boundedText(body.code, 16))
      return services.social.invite(actor, recipient.id, operationId(body.id))
    }
  }
  const relationship = identifier(body.relationship)
  if (!/^[a-f0-9]{64}$/.test(relationship)) throw new OnlineError("invalid-relationship")
  switch (command.type) {
    case "trade.read":
      return services.social.readTrade(actor, relationship, identifier(body.operation))
    case "friend.remove":
      await services.social.remove(actor, relationship, numberOf(body.generation))
      return { ok: true }
    case "challenge.send":
      await services.realtime.ownsBattleCode(actor, boundedText(body.battleCode, 6))
      return services.social.challenge(
        actor,
        relationship,
        numberOf(body.generation),
        operationId(body.id),
        boundedText(body.battleCode, 6),
      )
    case "invitation.decide":
      if (!["accepted", "declined", "canceled"].includes(String(body.decision)))
        throw new OnlineError("invalid-decision")
      return services.social.decideInvitation(
        actor,
        relationship,
        identifier(body.operation),
        body.decision as "accepted" | "declined" | "canceled",
      )
    case "gift.send":
      return services.social.sendGift(actor, relationship, numberOf(body.generation), operationId(body.id))
    case "gift.claim":
      return services.social.claimGift(
        actor,
        relationship,
        numberOf(body.generation),
        identifier(body.operation),
        destinationOf(body.destination),
      )
    case "gift.applied":
      await services.social.acknowledgeGift(
        actor,
        relationship,
        identifier(body.operation),
        destinationOf(body.destination),
      )
      return { ok: true }
    case "trade.prepare": {
      let offer: ReturnType<typeof parseOffer>
      try {
        offer = parseOffer(body.offer)
      } catch {
        throw new OnlineError("invalid-offer")
      }
      if (!offer) throw new OnlineError("invalid-offer")
      return services.social.prepareTrade(
        actor,
        relationship,
        numberOf(body.generation),
        operationId(body.id),
        destinationOf(body.destination),
        offer,
      )
    }
    case "trade.confirm":
      return services.social.confirmTrade(
        actor,
        relationship,
        identifier(body.operation),
        destinationOf(body.destination),
      )
    case "trade.cancel":
      return services.social.cancelTrade(actor, relationship, identifier(body.operation))
    case "trade.applied":
      await services.social.acknowledgeTrade(
        actor,
        relationship,
        identifier(body.operation),
        destinationOf(body.destination),
      )
      return { ok: true }
    case "trade.release":
      await services.social.releaseTrade(
        actor,
        relationship,
        identifier(body.operation),
        destinationOf(body.destination),
      )
      return { ok: true }
    default:
      throw new OnlineError("invalid-command")
  }
}
