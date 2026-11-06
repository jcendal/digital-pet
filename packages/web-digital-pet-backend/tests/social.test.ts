import { expect, test } from "bun:test"
import { INVITATION_LIFETIME_MS, jsonBytes, MAX_TRADE_OFFER_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import type { OnlineRelationship } from "@jcendal/digital-pet-online/social.ts"
import { parseEnvelope, parseOffer } from "@jcendal/web-digital-pet/protocol/social"
import { readBody } from "../src/http.ts"
import { relationshipId } from "../src/identity.ts"
import { SocialService } from "../src/social.ts"
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
  expect((await service.inbox("alice")).relationships[0]?.value.trades).toEqual([])
  expect(await service.readTrade("alice", id, "trade")).toMatchObject({ state: "committed", sides: {} })
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

test("a renewed friendship can trade while a previous generation still awaits its original device", async () => {
  const { service, id } = await setup()
  await service.prepareTrade("alice", id, 1, "old", phone, { partner: "a" })
  await service.prepareTrade("bob", id, 1, "old", friend, { partner: "b" })
  await service.confirmTrade("alice", id, "old", phone)
  await service.confirmTrade("bob", id, "old", friend)
  await service.acknowledgeTrade("alice", id, "old", phone)
  await expect(service.prepareTrade("alice", id, 1, "new", phone, { partner: "a" })).rejects.toThrow("trade-busy")
  await service.remove("alice", id, 1)
  await service.invite("alice", "bob", "again")
  await service.decideInvitation("bob", id, "again", "accepted")
  expect((await service.prepareTrade("alice", id, 2, "new", phone, { partner: "a" })).state).toBe("pending")
  expect((await service.readTrade("bob", id, "old")).state).toBe("committed")
  await service.acknowledgeTrade("bob", id, "old", friend)
  expect(await service.readTrade("bob", id, "old")).toMatchObject({ state: "committed", sides: {} })
})

test("inbox pagination packs small relationships and stops at the byte budget without skipping entries", async () => {
  for (const large of [false, true]) {
    const store = new MemoryStore(),
      service = new SocialService(store)
    const ids: string[] = []
    for (let index = 0; index < 32; index++) {
      const { id } = await service.invite("alice", `friend-${index}`, `invitation-${index}`)
      ids.push(id)
      if (large) {
        const found = await store.get<OnlineRelationship>(`relationships/${id}`)
        if (!found) throw new Error("Missing test relationship")
        found.value.trades = Array.from({ length: 35 }, (_, i) => ({
          id: `trade-${i}`,
          generation: 0,
          createdAt: Date.now(),
          expiresAt: Date.now(),
          state: "committed",
          confirmed: [],
          sides: { alice: { destination: phone, applied: false, offer: { data: "a".repeat(24000) } } },
        }))
        expect(jsonBytes(found.value)).toBeLessThan(1024 * 1024)
        await store.put(`relationships/${id}`, found.value, found.revision)
      }
    }
    let after: string | null = "",
      pages = 0
    const received: string[] = []
    while (after !== null) {
      const page = await service.inbox("alice", after)
      expect(jsonBytes(page)).toBeLessThan(3 * 1024 * 1024 + 1024)
      expect(page.relationships.length).toBeGreaterThan(0)
      received.push(...page.relationships.map((pair) => pair.id))
      after = page.next
      expect(++pages).toBeLessThanOrEqual(32)
    }
    expect(received).toEqual(ids.sort())
    if (!large) expect(pages).toBe(2)
  }
})

test("finished trade receipts retain retry identity without retaining large offers", async () => {
  const { service, id, store } = await setup()
  const offer = { history: "a".repeat(24_000) }
  for (let i = 0; i < 100; i++) {
    await service.prepareTrade("alice", id, 1, `trade-${i}`, phone, offer)
    await service.cancelTrade("alice", id, `trade-${i}`)
  }
  const record = await store.get(`relationships/${id}`)
  expect(jsonBytes(record?.value)).toBeLessThan(100_000)
  expect((await service.inbox("alice")).relationships[0]?.value.trades).toEqual([])
  expect((await service.prepareTrade("alice", id, 1, "trade-0", phone, offer)).state).toBe("canceled")
  await expect(service.prepareTrade("alice", id, 1, "trade-0", phone, { history: "changed" })).rejects.toThrow(
    "operation-conflict",
  )
  await expect(service.prepareTrade("alice", id, 1, "trade-0", laptop, offer)).rejects.toThrow("different-save")
})

test("lost-device recovery abandons only the actor's delivery and preserves the peer's offer", async () => {
  const { service, id } = await setup()
  await service.prepareTrade("alice", id, 1, "trade", phone, { partner: "a" })
  await service.prepareTrade("bob", id, 1, "trade", friend, { partner: "b" })
  await service.confirmTrade("alice", id, "trade", phone)
  await service.confirmTrade("bob", id, "trade", friend)
  await expect(service.releaseTrade("alice", id, "trade", phone)).rejects.toThrow("original-save")
  await expect(service.releaseTrade("mallory", id, "trade", laptop)).rejects.toThrow("forbidden")
  await service.releaseTrade("alice", id, "trade", laptop)
  await service.releaseTrade("alice", id, "trade", laptop)
  expect((await service.inbox("alice")).relationships[0]?.value.trades[0]?.state).toBe("canceled")
  const pending = (await service.inbox("bob")).relationships[0]?.value.trades[0]
  expect(pending).toMatchObject({
    state: "committed",
    sides: { alice: { abandoned: true, applied: true, offer: { partner: "a" } }, bob: { applied: false } },
  })
  await service.acknowledgeTrade("bob", id, "trade", friend)
  expect((await service.inbox("bob")).relationships[0]?.value.trades).toEqual([])
  await service.acknowledgeTrade("bob", id, "trade", friend)
  expect((await service.prepareTrade("alice", id, 1, "next", laptop, { partner: "c" })).state).toBe("pending")
})
