import { expect, test } from "bun:test"
import { INVITATION_LIFETIME_MS, MAX_TRADE_OFFER_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import { parseEnvelope, parseOffer } from "@jcendal/web-digital-pet/protocol/social"
import { readBody } from "../src/http.ts"
import { relationshipId, SocialService } from "../src/social.ts"
import { MemoryStore } from "./memory-store.ts"

const phone = { installationId: "phone", saveId: "phone-game" }
const laptop = { installationId: "laptop", saveId: "laptop-game" }
const friend = { installationId: "friend", saveId: "friend-game" }

test("a valid legacy offer with 256 history entries survives HTTP and the complete trade", async () => {
  const { service, id } = await setup()
  const now = Date.now(),
    createdAt = new Date(now).toISOString()
  const offer = parseOffer({
    slot: "principal",
    revision: 0,
    partner: {
      partnerId: "long-history",
      currentNodeId: "3-001",
      createdAt,
      lastTickAt: now,
      gauge: 100,
      isTerminal: false,
      events: Array.from({ length: 256 }, () => ({ currentNodeId: "3-001", createdAt })),
    },
  })
  parseEnvelope({ version: 1, id: "valid-proposal", event: { kind: "trade-offer", offer } })
  expect(Buffer.byteLength(JSON.stringify(offer))).toBeGreaterThan(16 * 1024)
  const body = readBody({
    rawPath: "/",
    headers: {},
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify({ offer, destination: phone }),
  })
  await service.prepareTrade("alice", id, 1, "trade", phone, body.offer)
  await service.prepareTrade("bob", id, 1, "trade", friend, offer)
  await service.confirmTrade("alice", id, "trade", phone)
  const result = await service.confirmTrade("bob", id, "trade", friend)
  expect(result.state).toBe("committed")
  expect(result.sides.alice?.offer).toEqual(offer)
  expect(result.sides.bob?.offer).toEqual(offer)
  expect(() =>
    service.prepareTrade("alice", id, 1, "oversized", phone, {
      extra: "x".repeat(MAX_TRADE_OFFER_BYTES),
    }),
  ).toThrow("invalid-offer")
})
const setup = async () => {
  const store = new MemoryStore()
  let time = Date.UTC(2026, 9, 31, 23, 59)
  const service = new SocialService(store, () => time)
  const { id } = await service.invite("alice", "bob", "invitation")
  await service.decideInvitation("bob", id, "invitation", "accepted")
  return {
    store,
    service,
    id,
    advance: (ms: number) => {
      time += ms
    },
  }
}

test("a sender can disappear after acknowledgement; the other account can discover the result", async () => {
  const { service, id } = await setup()
  await service.sendGift("alice", id, 1, "gift")
  const inbox = await service.inbox("bob")
  expect(inbox.relationships[0]?.value.active).toBe(true)
  expect(inbox.relationships[0]?.value.gifts[0]?.id).toBe("gift")
  expect((await service.inbox("unrelated")).relationships).toEqual([])
})

test("crashes before each publication boundary leave no acknowledged, hidden decision", async () => {
  for (const failure of [1, 2, 3]) {
    const store = new MemoryStore()
    store.failAt = failure
    const service = new SocialService(store)
    await expect(service.invite("alice", "bob", "request")).rejects.toThrow("Injected")
    store.failAt = Infinity
    const { id } = await service.invite("alice", "bob", "request")
    for (const actor of ["alice", "bob"]) expect((await service.inbox(actor)).relationships[0]?.id).toBe(id)
  }
})

test("invitation retry does not extend lifetime and accept/cancel has one winner", async () => {
  const store = new MemoryStore()
  let now = 100
  const service = new SocialService(store, () => now)
  const original = await service.invite("alice", "bob", "request")
  now += 1000
  expect((await service.invite("alice", "bob", "request")).invitation.expiresAt).toBe(original.invitation.expiresAt)
  const results = await Promise.allSettled([
    service.decideInvitation("alice", original.id, "request", "canceled"),
    service.decideInvitation("bob", original.id, "request", "accepted"),
  ])
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
})

test("gifts arrive across midnight, claim is bound to one local game, and daily limits survive retries", async () => {
  const { service, id, advance } = await setup()
  await service.sendGift("alice", id, 1, "gift")
  await expect(service.sendGift("alice", id, 1, "another")).rejects.toThrow("daily-gift-limit")
  advance(2 * 60 * 1000)
  expect((await service.claimGift("bob", id, 1, "gift", phone)).state).toBe("claimed")
  expect((await service.claimGift("bob", id, 1, "gift", phone)).destination).toEqual(phone)
  await expect(service.claimGift("bob", id, 1, "gift", laptop)).rejects.toThrow("different-save")
  await expect(service.claimGift("alice", id, 1, "gift", phone)).rejects.toThrow("forbidden")
  await service.acknowledgeGift("bob", id, "gift", phone)
})

test("removal cancels pending gifts but a decided claim remains recoverable on its destination", async () => {
  const { service, id, advance } = await setup()
  await service.sendGift("alice", id, 1, "claimed")
  await service.claimGift("bob", id, 1, "claimed", phone)
  advance(24 * 60 * 60 * 1000)
  await service.sendGift("alice", id, 1, "pending")
  await service.remove("alice", id, 1)
  await expect(service.claimGift("bob", id, 1, "pending", phone)).rejects.toThrow()
  expect((await service.claimGift("bob", id, 1, "claimed", phone)).state).toBe("claimed")
  await service.invite("alice", "bob", "new-generation")
  await service.decideInvitation("bob", id, "new-generation", "accepted")
  await expect(service.remove("alice", id, 1)).rejects.toThrow("relationship-changed")
})

test("expiry is enforced by server time even when physical objects still exist", async () => {
  const { service, id, advance } = await setup()
  await service.sendGift("alice", id, 1, "gift")
  advance(INVITATION_LIFETIME_MS + 1)
  await expect(service.claimGift("bob", id, 1, "gift", phone)).rejects.toThrow("gift-unavailable")
})

test("trade needs both exact destinations and confirmations; removal cannot undo a committed result", async () => {
  const { service, id } = await setup()
  await service.prepareTrade("alice", id, 1, "trade", phone, { partner: "a" })
  await service.prepareTrade("bob", id, 1, "trade", friend, { partner: "b" })
  await expect(service.confirmTrade("alice", id, "trade", laptop)).rejects.toThrow("different-save")
  expect((await service.confirmTrade("alice", id, "trade", phone)).state).toBe("pending")
  expect((await service.confirmTrade("bob", id, "trade", friend)).state).toBe("committed")
  await service.remove("alice", id, 1)
  await expect(service.cancelTrade("bob", id, "trade")).rejects.toThrow("trade-committed")
  await service.acknowledgeTrade("alice", id, "trade", phone)
  await service.acknowledgeTrade("bob", id, "trade", friend)
  expect((await service.inbox("alice")).relationships[0]?.value.trades[0]?.sides.bob?.applied).toBe(true)
})

test("removing a friendship aborts a prepared trade and rejects later confirmation", async () => {
  const { service, id } = await setup()
  await service.prepareTrade("alice", id, 1, "trade", phone, { partner: "a" })
  await service.prepareTrade("bob", id, 1, "trade", friend, { partner: "b" })
  await service.remove("alice", id, 1)
  await expect(service.confirmTrade("bob", id, "trade", friend)).rejects.toThrow()
})

test("new devices bootstrap canonical friendships without an original local invitation", async () => {
  const { service } = await setup()
  const result = await service.inbox("alice")
  expect(result.relationships[0]?.value.active).toBe(true)
  expect(result.relationships[0]?.id).toBe(relationshipId("alice", "bob"))
})

test("expired prepared trades no longer block a new exchange", async () => {
  const { service, id, advance } = await setup()
  await service.prepareTrade("alice", id, 1, "expired", phone, { partner: "a" })
  advance(INVITATION_LIFETIME_MS + 1)
  expect((await service.prepareTrade("alice", id, 1, "new", phone, { partner: "a" })).state).toBe("pending")
})

test("completed gift history stays bounded while unacknowledged decisions remain recoverable", async () => {
  const { service, id, advance } = await setup()
  await service.sendGift("alice", id, 1, "unacknowledged")
  await service.claimGift("bob", id, 1, "unacknowledged", phone)
  for (let day = 0; day < 300; day++) {
    advance(86_400_000)
    await service.sendGift("alice", id, 1, `gift-${day}`)
    await service.claimGift("bob", id, 1, `gift-${day}`, phone)
    await service.acknowledgeGift("bob", id, `gift-${day}`, phone)
  }
  const pair = (await service.inbox("bob")).relationships[0]?.value
  expect(pair?.gifts.length).toBeLessThanOrEqual(30)
  expect((await service.claimGift("bob", id, 1, "unacknowledged", phone)).state).toBe("claimed")
})

test("expired inbox references release capacity without removing active friendships", async () => {
  const { service, advance } = await setup()
  for (let i = 0; i < 127; i++) await service.invite(`stranger-${i}`, "bob", `request-${i}`)
  await expect(service.invite("new", "bob", "new")).rejects.toThrow("contacts-full")
  advance(INVITATION_LIFETIME_MS + 1)
  await service.invite("new", "bob", "new")
  const inbox = await service.inbox("bob")
  expect(inbox.relationships).toHaveLength(2)
  expect(inbox.relationships.some((pair) => pair.value.active)).toBe(true)
})
