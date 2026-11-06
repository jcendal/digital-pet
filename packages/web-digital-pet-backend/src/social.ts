import {
  type Destination,
  INVITATION_LIFETIME_MS,
  identifier,
  jsonBytes,
  MAX_TRADE_OFFER_BYTES,
  OnlineError,
  sameDestination,
} from "@jcendal/digital-pet-online/contracts.ts"
import type {
  OnlineGift as Gift,
  OnlineInvitation as Invitation,
  OnlineChallenge,
  OnlineTrade as Trade,
} from "@jcendal/digital-pet-online/social.ts"
import { type BattleRelationship, compactBattles } from "./battle-decisions.ts"
import { digest, relationshipId } from "./identity.ts"
import { change, type ObjectStore } from "./store.ts"

export type {
  OnlineGift as Gift,
  OnlineRelationship as Relationship,
  OnlineTrade as Trade,
} from "@jcendal/digital-pet-online/social.ts"

type Index = { relationships: string[]; touched: Record<string, number> }
type TradeReceipt = { trade: Trade; sides: Record<string, { destination: Destination; hash: string }> }
type Relationship = BattleRelationship & { tradeReceipts?: Record<string, TradeReceipt> }
const MAX_RELATIONSHIPS = 128
const MAX_RECORDS = 256
const missing = (): never => {
  throw new OnlineError("not-found", 404)
}

/** One relationship object serializes removal, gift claims and trade decisions. */
export class SocialService {
  constructor(
    private readonly store: ObjectStore,
    private readonly now: () => number = Date.now,
  ) {}

  private async reference(accountId: string, id: string): Promise<void> {
    const key = `social-index/${identifier(accountId)}`
    const found = await this.store.get<Index>(key)
    if (found && found.value.relationships.length >= MAX_RELATIONSHIPS && !found.value.relationships.includes(id)) {
      // Candidate leases are older than any 30-second Lambda invocation. CAS on the
      // index prevents removing a reference refreshed by a concurrent invitation.
      const disposable = new Set<string>()
      for (const candidate of found.value.relationships) {
        if ((found.value.touched[candidate] ?? 0) > this.now() - 120_000) continue
        const pair = await this.store.get<Relationship>(`relationships/${candidate}`)
        if (!pair) {
          disposable.add(candidate)
          continue
        }
        this.compact(pair.value)
        if (
          !pair.value.active &&
          !pair.value.invitations.some((item) => item.state === "pending") &&
          !pair.value.gifts.some((item) => item.state === "claimed" && !item.applied) &&
          !pair.value.trades.some(
            (item) => item.state === "committed" && Object.values(item.sides).some((side) => !side.applied),
          )
        )
          disposable.add(candidate)
      }
      if (disposable.size) {
        const next = found.value
        next.relationships = next.relationships.filter((candidate) => !disposable.has(candidate))
        for (const candidate of disposable) delete next.touched[candidate]
        await this.store.put(key, next, found.revision)
      }
    }
    await change<Index, void>(
      this.store,
      key,
      () => ({ relationships: [], touched: {} }),
      (index) => {
        if (index.relationships.includes(id)) {
          index.touched[id] = this.now()
          return
        }
        if (index.relationships.length >= MAX_RELATIONSHIPS) throw new OnlineError("contacts-full", 429)
        index.relationships.push(id)
        index.touched[id] = this.now()
        index.relationships.sort()
      },
    )
  }

  private update<R>(actor: string, id: string, apply: (value: Relationship) => R): Promise<R> {
    return change<Relationship, R>(this.store, `relationships/${identifier(id)}`, missing, (value) => {
      if (!value.members.includes(actor)) throw new OnlineError("forbidden", 403)
      this.compact(value)
      const result = apply(value)
      this.compact(value)
      return result
    })
  }

  private compact(pair: Relationship): void {
    const now = this.now()
    compactBattles(pair, now)
    const cutoff = now - 2 * INVITATION_LIFETIME_MS
    pair.challenges = (pair.challenges ?? []).filter((item) => item.expiresAt > now)
    for (const item of pair.trades) if (item.state === "pending" && item.expiresAt <= now) item.state = "canceled"
    for (const item of pair.gifts) if (item.state === "pending" && item.expiresAt <= now) item.state = "canceled"
    for (const item of pair.invitations) if (item.state === "pending" && item.expiresAt <= now) item.state = "canceled"
    pair.invitations = pair.invitations.filter((item) => item.createdAt > cutoff)
    pair.gifts = pair.gifts.filter((item) => item.createdAt > cutoff || (item.state === "claimed" && !item.applied))
    pair.trades = pair.trades.filter(
      (item) =>
        item.createdAt > cutoff ||
        (item.state === "committed" && Object.values(item.sides).some((side) => !side.applied)),
    )
    for (const trade of pair.trades) {
      if (
        trade.state === "canceled" ||
        (trade.state === "committed" && Object.values(trade.sides).every((side) => side.applied))
      ) {
        pair.tradeReceipts ??= {}
        pair.tradeReceipts[trade.id] = {
          trade: { ...trade, sides: {} },
          sides: Object.fromEntries(
            Object.entries(trade.sides).map(([actor, side]) => [
              actor,
              {
                destination: side.destination,
                hash: digest(JSON.stringify(side.offer)),
              },
            ]),
          ),
        }
      }
    }
    pair.trades = pair.trades.filter((trade) => !pair.tradeReceipts?.[trade.id])
    for (const [id, receipt] of Object.entries(pair.tradeReceipts ?? {}))
      if (receipt.trade.createdAt <= cutoff) delete pair.tradeReceipts?.[id]
  }

  private receipt(
    pair: Relationship,
    actor: string,
    id: string,
    destination?: Destination,
    offer?: unknown,
  ): Trade | undefined {
    const receipt = pair.tradeReceipts?.[id]
    if (!receipt) return
    const side = receipt.sides[actor]
    if (destination && (!side || !sameDestination(side.destination, destination)))
      throw new OnlineError("different-save", 409)
    if (offer !== undefined && side?.hash !== digest(JSON.stringify(offer)))
      throw new OnlineError("operation-conflict", 409)
    return receipt.trade
  }

  private assertActive(pair: Relationship, generation: number): void {
    if (!pair.active || pair.generation !== generation) throw new OnlineError("relationship-changed", 409)
  }

  async invite(actor: string, recipient: string, operationId: string): Promise<{ id: string; invitation: Invitation }> {
    const id = relationshipId(actor, recipient)
    identifier(operationId)
    // Discoverability is established for BOTH participants before the final write.
    // A crash here leaves only harmless references, never an acknowledged hidden decision.
    await this.reference(actor, id)
    await this.reference(recipient, id)
    const now = this.now()
    const invitation = await change<Relationship, Invitation>(
      this.store,
      `relationships/${id}`,
      () => ({
        members: [actor, recipient].sort() as [string, string],
        generation: 0,
        active: false,
        invitations: [],
        gifts: [],
        trades: [],
      }),
      (pair) => {
        this.compact(pair)
        const previous = pair.invitations.find((item) => item.id === operationId)
        if (previous) {
          if (previous.sender !== actor) throw new OnlineError("operation-conflict", 409)
          return previous
        }
        if (pair.active) throw new OnlineError("already-friends", 409)
        if (pair.invitations.some((item) => item.state === "pending" && item.expiresAt > now))
          throw new OnlineError("invitation-pending", 409)
        if (pair.invitations.length >= MAX_RECORDS) throw new OnlineError("relationship-full", 429)
        const result: Invitation = {
          id: operationId,
          sender: actor,
          createdAt: now,
          expiresAt: now + INVITATION_LIFETIME_MS,
          state: "pending",
        }
        pair.invitations.push(result)
        return result
      },
    )
    return { id, invitation }
  }

  decideInvitation(
    actor: string,
    id: string,
    operationId: string,
    decision: "accepted" | "declined" | "canceled",
  ): Promise<Invitation> {
    const now = this.now()
    return this.update(actor, id, (pair) => {
      const invitation = pair.invitations.find((item) => item.id === operationId) ?? missing()
      if ((decision === "canceled") !== (invitation.sender === actor)) throw new OnlineError("forbidden", 403)
      if (invitation.state === decision) return invitation
      if (invitation.state !== "pending" || invitation.expiresAt <= now)
        throw new OnlineError("invitation-finished", 409)
      invitation.state = decision
      if (decision === "accepted") {
        pair.generation++
        pair.active = true
      }
      return invitation
    })
  }

  remove(actor: string, id: string, generation: number): Promise<void> {
    return this.update(actor, id, (pair) => {
      if (pair.generation !== generation) throw new OnlineError("relationship-changed", 409)
      pair.active = false
      for (const battle of Object.values(pair.battles ?? {})) if (battle.state === "pending") battle.state = "canceled"
      pair.challenges = []
      for (const gift of pair.gifts) if (gift.state === "pending") gift.state = "canceled"
      for (const trade of pair.trades) if (trade.state === "pending") trade.state = "canceled"
    })
  }

  challenge(
    actor: string,
    id: string,
    generation: number,
    operationId: string,
    battleCode: string,
  ): Promise<OnlineChallenge> {
    if (!/^\d{6}$/.test(battleCode)) throw new OnlineError("invalid-code")
    return this.update(actor, id, (pair) => {
      this.assertActive(pair, generation)
      pair.challenges ??= []
      const old = pair.challenges.find((item) => item.id === operationId)
      if (old) {
        if (old.sender !== actor || old.battleCode !== battleCode) throw new OnlineError("operation-conflict", 409)
        return old
      }
      if (pair.challenges.length >= 8) throw new OnlineError("challenge-limit", 429)
      const value = {
        id: operationId,
        sender: actor,
        battleCode,
        createdAt: this.now(),
        expiresAt: this.now() + 120_000,
      }
      pair.challenges.push(value)
      return value
    })
  }

  sendGift(actor: string, id: string, generation: number, operationId: string): Promise<Gift> {
    identifier(operationId)
    const now = this.now()
    const day = new Date(now).toISOString().slice(0, 10)
    return this.update(actor, id, (pair) => {
      const previous = pair.gifts.find((gift) => gift.id === operationId)
      if (previous) {
        if (previous.sender !== actor) throw new OnlineError("operation-conflict", 409)
        return previous
      }
      this.assertActive(pair, generation)
      if (pair.gifts.some((gift) => gift.sender === actor && gift.day === day))
        throw new OnlineError("daily-gift-limit", 409)
      if (pair.gifts.length >= MAX_RECORDS) throw new OnlineError("relationship-full", 429)
      const recipient = pair.members.find((member) => member !== actor) ?? missing()
      const gift: Gift = {
        id: operationId,
        sender: actor,
        recipient,
        day,
        createdAt: now,
        expiresAt: now + INVITATION_LIFETIME_MS,
        state: "pending",
      }
      pair.gifts.push(gift)
      return gift
    })
  }

  claimGift(
    actor: string,
    id: string,
    generation: number,
    operationId: string,
    destination: Destination,
  ): Promise<Gift> {
    const now = this.now()
    return this.update(actor, id, (pair) => {
      const gift = pair.gifts.find((item) => item.id === operationId) ?? missing()
      if (gift.recipient !== actor) throw new OnlineError("forbidden", 403)
      if (gift.state === "claimed") {
        if (!gift.destination || !sameDestination(gift.destination, destination))
          throw new OnlineError("different-save", 409)
        return gift
      }
      this.assertActive(pair, generation)
      if (gift.state !== "pending" || gift.expiresAt <= now) throw new OnlineError("gift-unavailable", 409)
      gift.destination = destination
      gift.state = "claimed"
      gift.applied = false
      return gift
    })
  }

  acknowledgeGift(actor: string, id: string, operationId: string, destination: Destination): Promise<void> {
    return this.update(actor, id, (pair) => {
      const gift = pair.gifts.find((item) => item.id === operationId) ?? missing()
      if (gift.recipient !== actor || !gift.destination || !sameDestination(gift.destination, destination))
        throw new OnlineError("different-save", 409)
      if (gift.state !== "claimed") throw new OnlineError("gift-unavailable", 409)
      gift.applied = true
    })
  }

  async readTrade(actor: string, id: string, operationId: string): Promise<Trade> {
    const pair = (await this.store.get<Relationship>(`relationships/${identifier(id)}`))?.value ?? missing()
    if (!pair.members.includes(actor)) throw new OnlineError("forbidden", 403)
    this.compact(pair)
    return (
      pair.trades.find((item) => item.id === identifier(operationId)) ??
      this.receipt(pair, actor, operationId) ??
      missing()
    )
  }

  prepareTrade(
    actor: string,
    id: string,
    generation: number,
    operationId: string,
    destination: Destination,
    offer: unknown,
  ): Promise<Trade> {
    identifier(operationId)
    if (!offer || typeof offer !== "object" || jsonBytes(offer) > MAX_TRADE_OFFER_BYTES)
      throw new OnlineError("invalid-offer")
    const now = this.now()
    return this.update(actor, id, (pair) => {
      this.assertActive(pair, generation)
      const receipt = this.receipt(pair, actor, operationId, destination, offer)
      if (receipt) return receipt
      let trade = pair.trades.find((item) => item.id === operationId)
      if (!trade) {
        if (
          pair.trades.some(
            (item) =>
              item.state === "pending" ||
              (item.state === "committed" &&
                item.generation === generation &&
                Object.values(item.sides).some((side) => !side.applied)),
          )
        )
          throw new OnlineError("trade-busy", 409)
        if (pair.trades.length + Object.keys(pair.tradeReceipts ?? {}).length >= MAX_RECORDS)
          throw new OnlineError("relationship-full", 429)
        trade = {
          id: operationId,
          generation,
          createdAt: now,
          expiresAt: now + INVITATION_LIFETIME_MS,
          state: "pending",
          sides: {},
          confirmed: [],
        }
        pair.trades.push(trade)
      }
      const side = trade.sides[actor]
      if (side) {
        if (!sameDestination(side.destination, destination) || JSON.stringify(side.offer) !== JSON.stringify(offer))
          throw new OnlineError("operation-conflict", 409)
        return trade
      }
      if (trade.state !== "pending" || trade.expiresAt <= now) throw new OnlineError("trade-finished", 409)
      trade.sides[actor] = { destination, offer, applied: false }
      return trade
    })
  }

  confirmTrade(actor: string, id: string, operationId: string, destination: Destination): Promise<Trade> {
    const now = this.now()
    return this.update(actor, id, (pair) => {
      const receipt = this.receipt(pair, actor, operationId, destination)
      if (receipt) {
        if (receipt.state !== "committed") throw new OnlineError("trade-finished", 409)
        return receipt
      }
      const trade = pair.trades.find((item) => item.id === operationId) ?? missing()
      const side = trade.sides[actor]
      if (!side || !sameDestination(side.destination, destination)) throw new OnlineError("different-save", 409)
      if (trade.state === "committed") return trade
      this.assertActive(pair, trade.generation)
      if (trade.state !== "pending" || trade.expiresAt <= now || pair.members.some((member) => !trade.sides[member]))
        throw new OnlineError("trade-not-ready", 409)
      if (!trade.confirmed.includes(actor)) trade.confirmed.push(actor)
      if (pair.members.every((member) => trade.confirmed.includes(member))) trade.state = "committed"
      return trade
    })
  }

  cancelTrade(actor: string, id: string, operationId: string): Promise<Trade> {
    return this.update(actor, id, (pair) => {
      const trade =
        pair.trades.find((item) => item.id === operationId) ?? this.receipt(pair, actor, operationId) ?? missing()
      if (trade.state === "committed") throw new OnlineError("trade-committed", 409)
      trade.state = "canceled"
      return trade
    })
  }

  acknowledgeTrade(actor: string, id: string, operationId: string, destination: Destination): Promise<void> {
    return this.update(actor, id, (pair) => {
      const receipt = this.receipt(pair, actor, operationId, destination)
      if (receipt) {
        if (receipt.state !== "committed") throw new OnlineError("trade-not-committed", 409)
        return
      }
      const trade = pair.trades.find((item) => item.id === operationId) ?? missing()
      const side = trade.sides[actor]
      if (!side || !sameDestination(side.destination, destination)) throw new OnlineError("different-save", 409)
      if (trade.state !== "committed") throw new OnlineError("trade-not-committed", 409)
      side.applied = true
    })
  }

  releaseTrade(actor: string, id: string, operationId: string, destination: Destination): Promise<void> {
    return this.update(actor, id, (pair) => {
      if (pair.tradeReceipts?.[operationId]) return
      const trade = pair.trades.find((item) => item.id === operationId) ?? missing()
      const side = trade.sides[actor]
      if (!side || trade.state !== "committed") throw new OnlineError("trade-not-committed", 409)
      if (side.applied) return
      if (sameDestination(side.destination, destination)) throw new OnlineError("original-save", 409)
      // Explicit abandonment affects only this account's delivery; the peer's decision survives.
      side.applied = true
      side.abandoned = true
    })
  }

  /** Every sync starts a bounded round; a UUID cursor is never treated as a timestamp. */
  async inbox(
    actor: string,
    after = "",
  ): Promise<{ relationships: Array<{ id: string; value: Relationship }>; next: string | null }> {
    const index = await this.store.get<Index>(`social-index/${identifier(actor)}`)
    const ids = (index?.value.relationships ?? []).filter((id) => id > after)
    const relationships: Array<{ id: string; value: Relationship }> = []
    let bytes = 0
    let last = after
    // Pack small relationships together; reserve response space for profiles and framing.
    for (const id of ids.slice(0, 16)) {
      const found = await this.store.get<Relationship>(`relationships/${id}`)
      if (found?.value.members.includes(actor)) {
        this.compact(found.value)
        const { battles: _battles, tradeReceipts: _receipts, ...publicValue } = found.value
        // Older clients also interpret an abandoned delivery as canceled for its owner.
        publicValue.trades = publicValue.trades.map((trade) =>
          trade.sides[actor]?.abandoned ? { ...trade, state: "canceled" } : trade,
        )
        const entry = { id, value: publicValue }
        const size = jsonBytes(entry)
        if (relationships.length && bytes + size > 3 * 1024 * 1024) break
        relationships.push(entry)
        bytes += size
      }
      last = id
    }
    return { relationships, next: ids.some((id) => id > last) ? last : null }
  }
}
