import { expect, spyOn, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { SocketAssembly } from "@jcendal/digital-pet-online/socket-rpc.ts"
import { digest, type Session } from "../src/auth.ts"
import { Notifications } from "../src/notifications.ts"
import { RealtimeService } from "../src/realtime.ts"
import { socketAction } from "../src/socket-action.ts"
import { assertClientMessage, assertServerMessage, tradeResult } from "./contract-validation.ts"
import { MemoryStore } from "./memory-store.ts"

const setup = () => {
  const auth = new MemoryStore(),
    data = new MemoryStore()
  let now = Date.now()
  const sent: Array<{ connection: string; value: unknown }> = []
  const service = new RealtimeService(
    auth,
    data,
    {
      send: async (connection, value) => {
        sent.push({ connection, value })
        return true
      },
    },
    () => now,
  )
  const connect = async (accountId: string, connectionId: string, installationId = connectionId) => {
    const handle = randomBytes(32).toString("base64url")
    const session: Session = {
      accountId,
      csrf: "csrf",
      accessExpiresAt: now + 7_200_000,
      expiresAt: now + 365 * 86_400_000,
      revoked: false,
      encryptedRefresh: "ciphertext",
      claim: null,
    }
    await auth.put(`sessions/${digest(handle)}`, session, null)
    const ticket = await service.ticket(handle, installationId, session)
    await service.connect(connectionId, ticket.ticket)
    return { handle, ticket: ticket.ticket }
  }
  return {
    auth,
    data,
    service,
    sent,
    connect,
    advance: (ms: number) => {
      now += ms
    },
  }
}

test("expired resume and relay errors identify the channel and stop retries", async () => {
  const { service, connect, advance } = setup()
  await connect("alice", "a")
  await connect("bob", "b")
  const code = await service.register("b", "battle")
  const channel = await service.open("a", "battle", code, "request")
  advance(15 * 60_000 + 1)
  const replies: unknown[] = []
  const delivery = {
    send: async (_id: string, value: unknown) => {
      replies.push(value)
      return true
    },
  }
  for (const action of ["resume", "relay"]) {
    await socketAction(
      service,
      delivery,
      "a",
      JSON.stringify({
        action,
        channel,
        frame: { version: 1, channel, kind: "ack", sequence: 1 },
      }),
    )
    expect(replies.at(-1)).toMatchObject({ kind: "error", action, channel, retryable: false })
  }
})

test("a temporary storage error during resume remains retryable and a later attempt succeeds", async () => {
  const { service, connect, data } = setup()
  await connect("alice", "old", "phone")
  await connect("bob", "b")
  const code = await service.register("b", "battle")
  const channel = await service.open("old", "battle", code, "request")
  await connect("alice", "new", "phone")
  data.failAt = data.writes + 1
  const replies: unknown[] = []
  const delivery = {
    send: async (_id: string, value: unknown) => {
      replies.push(value)
      return true
    },
  }
  const log = spyOn(console, "error").mockImplementation(() => {})
  try {
    await socketAction(service, delivery, "new", JSON.stringify({ action: "resume", channel }))
    expect(replies.at(-1)).toMatchObject({ kind: "error", action: "resume", channel, retryable: true })
    expect(log).toHaveBeenCalledTimes(1)
    data.failAt = Infinity
    await socketAction(service, delivery, "new", JSON.stringify({ action: "resume", channel }))
    expect(replies.at(-1)).toEqual({ kind: "resumed", channel })
  } finally {
    log.mockRestore()
  }
})

test("socket tickets are single-use and every relay rechecks both sessions and room membership", async () => {
  const { service, connect, auth, sent } = setup()
  const alice = await connect("alice", "alice-socket")
  await expect(service.connect("stolen", alice.ticket)).rejects.toThrow("unauthorized")
  const bob = await connect("bob", "bob-socket")
  await connect("mallory", "other")
  const endpoint = await service.register("bob-socket", "battle")
  await expect(service.register("bob-socket", "unknown")).rejects.toThrow("invalid-endpoint")
  expect(endpoint).toMatch(/^\d{6}$/)
  const code = await service.open("alice-socket", "battle", endpoint, "request")
  const frame = { version: 1, channel: code, kind: "data", sequence: 1, payload: { message: "hello" } }
  await expect(service.relay("other", frame)).rejects.toThrow("forbidden")
  await service.relay("alice-socket", frame)
  expect(sent.at(-1)?.connection).toBe("bob-socket")
  const key = `sessions/${digest(bob.handle)}`
  const session = await auth.get<Session>(key)
  if (!session) throw new Error("Missing test session")
  await auth.put(key, { ...session.value, revoked: true }, session.revision)
  await expect(service.relay("alice-socket", frame)).rejects.toThrow("unauthorized")
})

test("reconnection replaces only the same account and installation; a third member cannot enter", async () => {
  const { service, connect } = setup()
  await connect("alice", "old", "phone")
  await connect("bob", "bob")
  await connect("mallory", "mallory")
  const endpoint = await service.register("bob", "battle")
  const code = await service.open("old", "battle", endpoint, "request")
  await expect(service.resume("mallory", code)).rejects.toThrow("forbidden")
  await connect("alice", "new", "phone")
  await service.resume("new", code)
  await expect(service.relay("old", { version: 1, channel: code, kind: "ack", sequence: 1 })).rejects.toThrow(
    "forbidden",
  )
  await service.relay("new", { version: 1, channel: code, kind: "ack", sequence: 1 })
})

test("retrying a lost open response binds the same channel to both replacement sockets", async () => {
  const { service, connect, data } = setup()
  await connect("alice", "old-a", "phone")
  await connect("bob", "old-b", "tablet")
  const code = await service.register("old-b", "transfer")
  const channel = await service.open("old-a", "transfer", code, "lost-open")
  await service.disconnect("old-a")
  await service.disconnect("old-b")
  await connect("alice", "new-a", "phone")
  await connect("bob", "new-b", "tablet")
  expect(await service.register("new-b", "transfer")).toBe(code)
  expect(await service.open("new-a", "transfer", code, "lost-open")).toBe(channel)
  await service.relay("new-a", { version: 1, channel, kind: "ack", sequence: 1 })
  await service.relay("new-b", { version: 1, channel, kind: "ack", sequence: 1 })
  const before = await data.get(`realtime/channels/${channel}`)
  await service.open("new-a", "transfer", code, "lost-open")
  expect((await data.get(`realtime/channels/${channel}`))?.revision).toBe(before?.revision)
})

test("an open retry cannot replace its original recipient when a code is reassigned", async () => {
  const { service, connect, data } = setup()
  await connect("alice", "a")
  await connect("bob", "b")
  const code = await service.register("b", "battle")
  await service.open("a", "battle", code, "request")
  await connect("mallory", "m")
  const key = `realtime/endpoints/battle/${code}`
  const endpoint = await data.get<Record<string, unknown>>(key)
  if (!endpoint) throw new Error("Missing endpoint")
  await data.put(
    key,
    { ...endpoint.value, accountId: "mallory", installationId: "m", connectionId: "m" },
    endpoint.revision,
  )
  await expect(service.open("a", "battle", code, "request")).rejects.toThrow("request-conflict")
})

test("a peer disconnect is retryable until the same participant resumes", async () => {
  const { service, connect } = setup()
  await connect("alice", "a")
  await connect("bob", "old-b", "tablet")
  const code = await service.register("old-b", "battle")
  const channel = await service.open("a", "battle", code, "request")
  await service.disconnect("old-b")
  const replies: unknown[] = []
  const frame = { version: 1, channel, kind: "ack", sequence: 1 }
  await socketAction(
    service,
    {
      send: async (_id, value) => {
        replies.push(value)
        return true
      },
    },
    "a",
    JSON.stringify({ action: "relay", frame }),
  )
  expect(replies.at(-1)).toMatchObject({ kind: "error", channel, error: "peer-offline", retryable: true })
  await connect("bob", "new-b", "tablet")
  await service.resume("new-b", channel)
  await service.relay("a", frame)
})

test("registered endpoints open isolated channels and reject another account resuming them", async () => {
  const { service, connect, sent, advance } = setup()
  await connect("alice", "a", "phone")
  await connect("bob", "b", "tablet")
  await connect("mallory", "m", "phone")
  const code = await service.register("b", "transfer")
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{16}$/)
  const channel = await service.open("a", "transfer", code, "request-1")
  expect(channel).toHaveLength(64)
  expect(await service.open("a", "transfer", code, "request-1")).toBe(channel)
  await expect(service.resume("m", channel)).rejects.toThrow("forbidden")
  await connect("alice", "a2", "phone")
  await service.resume("a2", channel)
  await expect(service.relay("a", { version: 1, channel, kind: "ack", sequence: 1 })).rejects.toThrow("forbidden")
  await service.relay("a2", { version: 1, channel, kind: "ack", sequence: 1 })
  expect(sent.at(-1)?.connection).toBe("b")
  advance(91_000)
  expect(await service.open("a2", "transfer", code, "request-2")).toHaveLength(64)
  await service.disconnect("b")
  await expect(service.open("a2", "transfer", code, "request-3")).rejects.toThrow("unauthorized")
})

test("battle decision survives disconnect, binds both destinations and rejects mismatched plans", async () => {
  const { service, connect, advance } = setup()
  await connect("alice", "a", "phone")
  await connect("bob", "b", "tablet")
  const code = await service.register("b", "battle")
  const channel = await service.open("a", "battle", code, "battle-1")
  const a = { installationId: "phone", saveId: "save-a" },
    b = { installationId: "tablet", saveId: "save-b" }
  const report = "a".repeat(64)
  expect((await service.battleDecision("alice", channel, a, report)).state).toBe("pending")
  await expect(service.battleDecision("alice", channel, { ...a, saveId: "new" }, report)).rejects.toThrow(
    "destination-conflict",
  )
  expect((await service.battleDecision("bob", channel, b, report)).state).toBe("committed")
  await service.disconnect("a")
  advance(2 * 86_400_000)
  expect((await service.battleDecision("alice", channel, a)).state).toBe("committed")
  await expect(service.battleDecision("mallory", channel, a, report)).rejects.toThrow("forbidden")
})

test("incomplete battle reports expire and disagreeing reports never award a battle", async () => {
  const { service, connect, advance } = setup()
  await connect("alice", "a", "phone")
  await connect("bob", "b", "tablet")
  const code = await service.register("b", "battle")
  const first = await service.open("a", "battle", code, "first")
  const a = { installationId: "phone", saveId: "a" },
    b = { installationId: "tablet", saveId: "b" }
  await service.battleDecision("alice", first, a, "a".repeat(64))
  expect((await service.battleDecision("bob", first, b, "b".repeat(64))).state).toBe("canceled")
  const second = await service.open("a", "battle", code, "second")
  await service.battleDecision("alice", second, a, "a".repeat(64))
  advance(120_001)
  expect((await service.battleDecision("bob", second, b, "a".repeat(64))).state).toBe("canceled")
  expect((await service.battleDecision("alice", "missing", a)).state).toBe("canceled")
})

test("storage events notify subscribed members without polling and stale disconnects preserve a newer socket", async () => {
  const { service, data, connect, sent } = setup()
  await connect("alice", "a", "phone")
  await connect("bob", "old", "tablet")
  await service.subscribe("a")
  await service.subscribe("old")
  await connect("bob", "new", "tablet")
  await service.subscribe("new")
  await service.disconnect("old")
  expect(await service.online("bob")).toBe(true)
  const notifications = new Notifications(data, service)
  const pair = "a".repeat(64)
  await data.put(`relationships/${pair}`, { members: ["alice", "bob"], active: true }, null)
  sent.length = 0
  await notifications.changed(`relationships/${pair}`, "revision-1")
  expect(sent.map((item) => item.connection).sort()).toEqual(["a", "new"])
  expect(sent[0]?.value).toEqual({ kind: "changed", topic: "social", eventId: `relationships/${pair}:revision-1` })
  await service.disconnect("new")
  expect(await service.online("bob")).toBe(false)
  sent.length = 0
  await notifications.changed(`relationships/${pair}`, "revision-2")
  expect(sent.map((item) => item.connection)).toEqual(["a"])
})

test("presence changes notify only current friends and notifications recheck revoked sessions", async () => {
  const { service, data, auth, connect, sent } = setup()
  await connect("alice", "a")
  const bob = await connect("bob", "b")
  await service.subscribe("a")
  await service.subscribe("b")
  const pair = "b".repeat(64)
  await data.put("social-index/alice", { relationships: [pair] }, null)
  await data.put(`relationships/${pair}`, { members: ["alice", "bob"], active: true }, null)
  const notifications = new Notifications(data, service)
  sent.length = 0
  await notifications.changed("realtime/subscribers/alice", "1")
  expect(sent.map((item) => item.connection)).toEqual(["b"])
  const key = `sessions/${digest(bob.handle)}`
  const stored = (await auth.get<Session>(key))!
  await auth.put(key, { ...stored.value, revoked: true }, stored.revision)
  sent.length = 0
  await notifications.changed("realtime/subscribers/alice", "2")
  expect(sent).toHaveLength(0)
})

test("replaying the same pending battle report creates no new S3 event or notification feedback loop", async () => {
  const { service, data, connect } = setup()
  await connect("alice", "a")
  await connect("bob", "b")
  const code = await service.register("b", "battle")
  const channel = await service.open("a", "battle", code, "once")
  const destination = { installationId: "a", saveId: "save-a" }
  const first = await service.battleDecision("alice", channel, destination, "a".repeat(64))
  const writes = data.writes
  expect(await service.battleDecision("alice", channel, destination, "a".repeat(64))).toEqual(first)
  expect(data.writes).toBe(writes)
})

test("socket commands use the authenticated actor and the same application rules as HTTP", async () => {
  const { Accounts } = await import("../src/accounts.ts")
  const { SocialService } = await import("../src/social.ts")
  const { socialSocket } = await import("../src/social-socket.ts")
  const { service, data, auth, connect } = setup()
  const { handle } = await connect("alice", "a")
  const services = { accounts: new Accounts(data), social: new SocialService(data), realtime: service }
  const responses: unknown[] = []
  const delivery = {
    send: async (_id: string, value: unknown) => {
      responses.push(value)
      return true
    },
  }
  const send = (accountId: string, type: string, input = {}, responseChunks = false) =>
    socialSocket(
      services,
      delivery,
      "a",
      JSON.stringify({
        action: "social",
        requestId: "request",
        accountId,
        command: { type, input },
        responseChunks,
      }),
    )
  await send("bob", "profile.rename", { alias: "Forged" })
  expect(responses.at(-1)).toMatchObject({ status: 409, body: { error: "account-changed" } })
  await send("alice", "profile.rename", { alias: "Alice" })
  expect(responses.at(-1)).toMatchObject({ status: 200, body: { id: "alice", alias: "Alice" } })
  await send("alice", "inbox.read")
  expect(responses.at(-1)).toMatchObject({ status: 413, body: { error: "http-required" } })
  await send("alice", "inbox.read", {}, true)
  expect(responses.at(-1)).toMatchObject({ status: 200, body: { relationships: [] } })
  const key = `sessions/${digest(handle)}`
  const stored = (await auth.get<Session>(key))!
  await auth.put(key, { ...stored.value, revoked: true }, stored.revision)
  await send("alice", "profile.rename", { alias: "Revoked" })
  expect(responses.at(-1)).toMatchObject({ status: 401 })
  expect((await services.accounts.ensure("alice")).alias).toBe("Alice")
})

test("large committed socket results use an authorized HTTP read resource without repeating the mutation", async () => {
  const { Accounts } = await import("../src/accounts.ts")
  const { SocialService } = await import("../src/social.ts")
  const { socialSocket } = await import("../src/social-socket.ts")
  const { executeSocial } = await import("../src/social-application.ts")
  const { socialCommandFor } = await import("@jcendal/digital-pet-online/social-commands.ts")
  const { service, data, connect } = setup()
  await connect("alice", "a")
  const social = new SocialService(data)
  const services = { accounts: new Accounts(data), social, realtime: service }
  const { id } = await social.invite("alice", "bob", "invite")
  await social.decideInvitation("bob", id, "invite", "accepted")
  const generation = (await social.inbox("alice")).relationships[0]!.value.generation
  const destination = { installationId: "a", saveId: "save-a" }
  const other = { installationId: "b", saveId: "save-b" }
  const largeOffer = { history: "á".repeat(7000) }
  await social.prepareTrade("alice", id, generation, "trade", destination, largeOffer)
  await social.prepareTrade("bob", id, generation, "trade", other, largeOffer)
  await social.confirmTrade("bob", id, "trade", other)
  const replies: Array<{ status: number; body: { location: string } }> = []
  await socialSocket(
    services,
    {
      send: async (_id, value) => {
        replies.push(value as (typeof replies)[number])
        return true
      },
    },
    "a",
    JSON.stringify({
      requestId: "request",
      accountId: "alice",
      command: {
        type: "trade.confirm",
        input: { relationship: id, operation: "trade", destination },
      },
    }),
  )
  expect(replies[0]?.status).toBe(303)
  expect(Buffer.byteLength(JSON.stringify(replies[0]))).toBeLessThan(1024)
  const read = socialCommandFor("GET", replies[0]!.body.location, {})!
  const writes = data.writes
  expect(await executeSocial(services, "alice", read)).toMatchObject({
    state: "committed",
    confirmed: ["bob", "alice"],
  })
  expect(data.writes).toBe(writes)
  const assembly = new SocketAssembly()
  let result: string | undefined
  let frames = 0
  await socialSocket(
    services,
    {
      send: async (_connection, value) => {
        const message = value as { kind: string; fragment: unknown }
        expect(message.kind).toBe("response-part")
        expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThanOrEqual(24 * 1024)
        result = assembly.add(message.fragment)
        frames++
        return true
      },
    },
    "a",
    JSON.stringify({ requestId: "chunked", accountId: "alice", responseChunks: true, command: read }),
  )
  expect(frames).toBeGreaterThan(1)
  expect(JSON.parse(result!)).toMatchObject({ state: "committed", confirmed: ["bob", "alice"] })
  expect(data.writes).toBe(writes)
  await expect(executeSocial(services, "mallory", read)).rejects.toThrow("forbidden")
})

test("fragmented valid trade commands cross Lambda instances and return schema-valid chunked results", async () => {
  const { Accounts } = await import("../src/accounts.ts")
  const { SocialService } = await import("../src/social.ts")
  const { SocketRequests } = await import("../src/socket-requests.ts")
  const { socialSocket } = await import("../src/social-socket.ts")
  const { parseOffer } = await import("@jcendal/web-digital-pet/protocol/social")
  const { service, data, connect } = setup()
  await connect("alice", "a")
  const social = new SocialService(data)
  const services = { accounts: new Accounts(data), social, realtime: service }
  const replicas = [new SocketRequests(data), new SocketRequests(data)]
  const { id } = await social.invite("alice", "bob", "invite")
  await social.decideInvitation("bob", id, "invite", "accepted")
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
  const operation = `${now}-${crypto.randomUUID()}`
  const destination = { installationId: "a", saveId: "save-a" }
  await social.prepareTrade("bob", id, 1, operation, { installationId: "b", saveId: "save-b" }, offer)
  const command = {
    type: "trade.prepare",
    input: { id: operation, relationship: id, generation: 1, destination, offer },
  }
  assertClientMessage({ action: "social", requestId: "whole", accountId: "alice", responseChunks: true, command })
  // Exercise the fragmented path with a real, validated offer. Maximum game histories currently fit in
  // one request frame, but the two participants' combined result needs multiple response frames.
  const source = JSON.stringify(command),
    midpoint = Math.floor(source.length / 2)
  const parts = [source.slice(0, midpoint), source.slice(midpoint)].map((data, index) => ({ index, total: 2, data }))
  const replies: Record<string, unknown>[] = []
  const delivery = {
    send: async (_connection: string, value: unknown) => {
      assertServerMessage(value)
      expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThanOrEqual(24 * 1024)
      replies.push(value as Record<string, unknown>)
      return true
    },
  }
  const send = async (index: number, replica: number) => {
    const frame = {
      action: "social",
      requestId: "fragmented",
      accountId: "alice",
      responseChunks: true,
      fragment: parts[index],
    }
    assertClientMessage(frame)
    await socialSocket({ ...services, requests: replicas[replica]! }, delivery, "a", JSON.stringify(frame))
  }
  await socialSocket(
    { ...services, requests: replicas[0]! },
    delivery,
    "a",
    JSON.stringify({
      action: "social",
      requestId: "fragmented",
      accountId: "alice",
      responseChunks: true,
      command: { type: "profile.read", input: {} },
      fragment: parts[0],
    }),
  )
  expect(replies).toEqual([
    { kind: "response", requestId: "fragmented", status: 400, body: { error: "invalid-fragment" } },
  ])
  replies.length = 0
  await send(1, 0)
  await send(1, 1)
  expect(replies).toHaveLength(0)
  expect((await social.readTrade("alice", id, operation)).sides.alice).toBeUndefined()
  await send(0, 1)
  expect(replies.length).toBeGreaterThan(1)
  const assembly = new SocketAssembly()
  let assembled: string | undefined
  for (const reply of [...replies].reverse()) {
    expect(reply).toMatchObject({ kind: "response-part", requestId: "fragmented", status: 200 })
    assembled = assembly.add(reply.fragment)
  }
  const trade = JSON.parse(assembled!)
  expect(tradeResult(trade)).toBe(true)
  expect(trade).toMatchObject({ id: operation, state: "pending", sides: { alice: { offer }, bob: { offer } } })
  const count = replies.length
  await send(0, 0)
  expect(replies).toHaveLength(count)
  expect((await social.inbox("alice")).relationships[0]!.value.trades).toHaveLength(1)
})

test("friend battles resolve the authenticated recipient and stop when friendship changes or the request expires", async () => {
  const { SocialService } = await import("../src/social.ts")
  const { service, data, connect, sent, advance } = setup()
  const social = new SocialService(data)
  await connect("alice", "a")
  await connect("bob", "b")
  await connect("mallory", "m")
  await service.register("b", "battle")
  await service.register("m", "battle")
  await expect(service.open("a", "battle", "", "no-friend", "bob")).rejects.toThrow("not-friends")
  const { id } = await social.invite("alice", "bob", "invitation")
  await social.decideInvitation("bob", id, "invitation", "accepted")
  await connect("bob", "b-second", "other-device")
  await service.register("b-second", "battle")
  await service.disconnect("b-second")
  // A closed second device must not hide the original online device.
  // The receiver's acceptance completes friendship for both accounts; no reciprocal decision exists.
  expect((await social.inbox("alice")).relationships[0]?.value.active).toBe(true)
  await expect(service.open("a", "transfer", "", "wrong-namespace", "bob")).rejects.toThrow("invalid-endpoint")
  await expect(service.open("a", "battle", "", "wrong-recipient", "mallory")).rejects.toThrow("not-friends")
  const channel = await service.open("a", "battle", "", "friend-request", "bob")
  expect(sent.at(-1)).toMatchObject({ connection: "b", value: { kind: "incoming", channel } })
  const replies: unknown[] = []
  await socketAction(
    service,
    {
      send: async (_connection, value) => {
        replies.push(value)
        return true
      },
    },
    "a",
    JSON.stringify({ action: "open", namespace: "battle", code: "", friend: "bob", requestId: "friend-request" }),
  )
  expect(replies).toEqual([{ kind: "opened", requestId: "friend-request", channel }])
  const frame = { version: 1, channel, kind: "ack", sequence: 1 }
  await service.relay("a", frame)
  await social.remove("alice", id, 1)
  await expect(service.relay("a", frame)).rejects.toThrow("not-friends")
  await social.invite("alice", "bob", "again")
  await social.decideInvitation("bob", id, "again", "accepted")
  await expect(service.relay("a", frame)).rejects.toThrow("not-friends")
  const next = await service.open("a", "battle", "", "next-request", "bob")
  advance(120_001)
  await expect(service.relay("b", { ...frame, channel: next })).rejects.toThrow("room-expired")
  await service.disconnect("b")
  await expect(service.open("a", "battle", "", "disconnected", "bob")).rejects.toThrow()
})

test("friend removal and the final battle report have one canonical decision", async () => {
  const { SocialService } = await import("../src/social.ts")
  for (const order of ["remove", "commit", "race"] as const) {
    const { service, data, connect } = setup()
    const social = new SocialService(data)
    await connect("alice", "a")
    await connect("bob", "b")
    await service.register("b", "battle")
    const { id } = await social.invite("alice", "bob", "invite")
    await social.decideInvitation("bob", id, "invite", "accepted")
    const channel = await service.open("a", "battle", "", "battle-request", "bob")
    const a = { installationId: "a", saveId: "save-a" },
      b = { installationId: "b", saveId: "save-b" }
    await service.battleDecision("alice", channel, a, "a".repeat(64))
    if (order === "remove") await social.remove("alice", id, 1)
    if (order === "commit") await service.battleDecision("bob", channel, b, "a".repeat(64))
    const [decision] = await Promise.all([
      service.battleDecision("bob", channel, b, "a".repeat(64)),
      social.remove("alice", id, 1),
    ])
    expect(decision.state).toBe(order === "commit" ? "committed" : "canceled")
    expect((await service.battleDecision("alice", channel, a)).state).toBe(decision.state)
    const inbox = JSON.stringify(await social.inbox("alice"))
    expect(inbox).not.toContain('"battles"')
  }
})

test("a committed friend battle recovers after failed publication, channel expiry and removal", async () => {
  const { SocialService } = await import("../src/social.ts")
  const { service, data, connect, advance } = setup()
  const social = new SocialService(data)
  await connect("alice", "a")
  await connect("bob", "b")
  await service.register("b", "battle")
  const { id } = await social.invite("alice", "bob", "invite")
  await social.decideInvitation("bob", id, "invite", "accepted")
  const channel = await service.open("a", "battle", "", "battle-request", "bob")
  const a = { installationId: "a", saveId: "save-a" },
    b = { installationId: "b", saveId: "save-b" }
  await service.battleDecision("alice", channel, a, "a".repeat(64))
  data.failAt = data.writes + 2 // Relationship commit succeeds; publication of the terminal copy fails.
  await expect(service.battleDecision("bob", channel, b, "a".repeat(64))).rejects.toThrow("Injected")
  data.failAt = Infinity
  await social.remove("alice", id, 1)
  advance(300_000)
  expect((await service.battleDecision("alice", channel, a)).state).toBe("committed")
  expect((await service.battleDecision("bob", channel, b)).state).toBe("committed")
})
