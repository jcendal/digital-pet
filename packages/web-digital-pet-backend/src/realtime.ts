import {
  type Destination,
  identifier,
  OnlineError,
  parseFrame,
  type SessionView,
} from "@jcendal/digital-pet-online/contracts.ts"
import type { OnlineRelationship } from "@jcendal/digital-pet-online/social.ts"
import type { Session } from "./auth.ts"
import { BattleDecisions } from "./battle-decisions.ts"
import { digest, relationshipId } from "./identity.ts"
import { SocketTickets, type Ticket } from "./socket-tickets.ts"
import { change, type ObjectStore } from "./store.ts"

type Connection = { accountId: string; sessionKey: string; installationId: string; expiresAt: number; closed: boolean }
type Member = { accountId: string; installationId: string; connectionId: string }
type Endpoint = Member & { namespace: string; code: string; expiresAt: number }
type FriendEndpoints = { endpoints: Endpoint[] }
type Link = {
  namespace: string
  members: (Member & { code: string })[]
  expiresAt: number
  friendship?: { id: string; generation: number }
}
type Subscribers = { connections: (Member & { expiresAt: number })[] }
export interface SocketDelivery {
  send(connectionId: string, value: unknown): Promise<boolean>
  connected?(connectionId: string): Promise<boolean>
}

/** Short-lived rendezvous and relay only. Game decisions belong to durable domain services. */
export class RealtimeService {
  constructor(
    private readonly authStore: ObjectStore,
    private readonly store: ObjectStore,
    private readonly delivery: SocketDelivery,
    private readonly now: () => number = Date.now,
  ) {}

  ticket(handle: string, installationId: string, session: SessionView) {
    return new SocketTickets(this.authStore, this.now).ticket(handle, installationId, session)
  }

  private async session(key: string): Promise<Session> {
    const found = await this.authStore.get<Session>(`sessions/${key}`)
    if (!found || found.value.revoked || Math.min(found.value.expiresAt, found.value.accessExpiresAt) <= this.now())
      throw new OnlineError("unauthorized", 401)
    return found.value
  }

  async connect(connectionId: string, ticket: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw new OnlineError("unauthorized", 401)
    const key = `tickets/${digest(ticket)}`
    const found = await this.authStore.get<Ticket>(key)
    if (!found || found.value.used || found.value.expiresAt <= this.now()) throw new OnlineError("unauthorized", 401)
    const session = await this.session(found.value.sessionKey)
    if (!(await this.authStore.put(key, { ...found.value, used: true }, found.revision)))
      throw new OnlineError("unauthorized", 401)
    const value: Connection = {
      accountId: session.accountId,
      sessionKey: found.value.sessionKey,
      installationId: found.value.installationId,
      expiresAt: Math.min(this.now() + 7_200_000, session.accessExpiresAt),
      closed: false,
    }
    if (!(await this.store.put(`realtime/connections/${digest(connectionId)}`, value, null)))
      throw new OnlineError("connection-conflict", 409)
  }

  async disconnect(connectionId: string): Promise<void> {
    const key = `realtime/connections/${digest(connectionId)}`
    const current = await this.store.get<Connection>(key)
    if (current)
      await change<Connection, void>(
        this.store,
        key,
        () => current.value,
        (value) => {
          value.closed = true
        },
      )
    if (current) {
      const subscribers = await this.store.get<Subscribers>(`realtime/subscribers/${current.value.accountId}`)
      if (subscribers?.value.connections.some((item) => item.connectionId === connectionId))
        await change<Subscribers, void>(
          this.store,
          `realtime/subscribers/${current.value.accountId}`,
          () => ({ connections: [] }),
          (value) => {
            value.connections = value.connections.filter((item) => item.connectionId !== connectionId)
          },
        )
    }
  }

  /** Subscribe only after the socket is open. No heartbeat or mailbox polling. */
  async subscribe(connectionId: string): Promise<void> {
    const connection = await this.connection(connectionId)
    await change<Subscribers, void>(
      this.store,
      `realtime/subscribers/${connection.accountId}`,
      () => ({ connections: [] }),
      (value) => {
        value.connections = value.connections.filter(
          (item) => item.expiresAt > this.now() && item.installationId !== connection.installationId,
        )
        if (value.connections.length >= 8) throw new OnlineError("device-limit", 409)
        value.connections.push({ ...connection, connectionId })
      },
    )
  }

  private async subscribers(accountId: string): Promise<Subscribers["connections"]> {
    const value = await this.store.get<Subscribers>(`realtime/subscribers/${identifier(accountId)}`)
    return (value?.value.connections ?? []).filter((item) => item.expiresAt > this.now())
  }

  async online(accountId: string): Promise<boolean> {
    for (const member of await this.subscribers(accountId)) {
      try {
        await this.connection(member.connectionId)
        if (!this.delivery.connected || (await this.delivery.connected(member.connectionId))) return true
      } catch (error) {
        if (!(error instanceof OnlineError) || error.status !== 401) throw error
      }
    }
    return false
  }

  async notify(accountId: string, topic: "social" | "battle", eventId: string): Promise<void> {
    for (const member of await this.subscribers(accountId)) {
      try {
        await this.connection(member.connectionId)
      } catch (error) {
        if (error instanceof OnlineError && error.status === 401) continue
        throw error
      }
      if (!(await this.delivery.send(member.connectionId, { kind: "changed", topic, eventId })))
        await this.disconnect(member.connectionId)
    }
  }

  private async connection(id: string, unavailableCode = "unauthorized"): Promise<Connection> {
    const found = await this.store.get<Connection>(`realtime/connections/${digest(id)}`)
    if (!found || found.value.closed || found.value.expiresAt <= this.now())
      throw new OnlineError(unavailableCode, unavailableCode === "unauthorized" ? 401 : 409)
    const session = await this.session(found.value.sessionKey)
    if (session.accountId !== found.value.accountId) throw new OnlineError("unauthorized", 401)
    return found.value
  }
  async identity(connectionId: string): Promise<string> {
    return (await this.connection(connectionId)).accountId
  }

  async ownsBattleCode(actor: string, code: string): Promise<void> {
    if (!/^\d{6}$/.test(code)) throw new OnlineError("invalid-endpoint")
    const found = await this.store.get<Endpoint>(`realtime/endpoints/battle/${code}`)
    if (!found || found.value.accountId !== actor || found.value.expiresAt <= this.now())
      throw new OnlineError("endpoint-offline", 409)
    await this.connection(found.value.connectionId)
  }

  async battleDecision(
    actor: string,
    channel: string,
    destination: Destination,
    report?: string,
  ): Promise<{ state: "pending" | "committed" | "canceled"; expiresAt?: number }> {
    return new BattleDecisions(this.store, this.now).decide(actor, channel, destination, report)
  }

  async register(connectionId: string, namespace: string): Promise<string> {
    if (namespace !== "battle" && namespace !== "transfer") throw new OnlineError("invalid-endpoint")
    const connection = await this.connection(connectionId)
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for (let attempt = 0; attempt < 10; attempt++) {
      const hash = digest(`${namespace}:${connection.accountId}:${connection.installationId}:${attempt}`)
      const code =
        namespace === "battle"
          ? String(Number.parseInt(hash.slice(0, 12), 16) % 1_000_000).padStart(6, "0")
          : Array.from(
              { length: 16 },
              (_, index) => alphabet[Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16) % 32],
            ).join("")
      const key = `realtime/endpoints/${namespace}/${code}`
      const found = await this.store.get<Endpoint>(key)
      if (
        found &&
        found.value.expiresAt > this.now() &&
        (found.value.accountId !== connection.accountId || found.value.installationId !== connection.installationId)
      )
        continue
      const value: Endpoint = {
        accountId: connection.accountId,
        installationId: connection.installationId,
        connectionId,
        namespace,
        code,
        expiresAt: connection.expiresAt,
      }
      if (await this.store.put(key, value, found?.revision ?? null)) {
        if (namespace === "battle")
          await change<FriendEndpoints, void>(
            this.store,
            `realtime/friend-endpoints/${connection.accountId}`,
            () => ({ endpoints: [] }),
            (current) => {
              current.endpoints = current.endpoints
                .filter((item) => item.expiresAt > this.now() && item.installationId !== value.installationId)
                .slice(-7)
              current.endpoints.push(value)
            },
          )
        return code
      }
    }
    throw new OnlineError("endpoint-limit", 429)
  }

  async open(
    connectionId: string,
    namespace: string,
    code: string,
    requestId: string,
    friend?: string,
  ): Promise<string> {
    identifier(requestId)
    const actor = await this.connection(connectionId)
    let friendship: Link["friendship"]
    if (friend !== undefined) {
      identifier(friend)
      if (namespace !== "battle" || code !== "" || friend === actor.accountId) throw new OnlineError("invalid-endpoint")
      const id = relationshipId(actor.accountId, friend)
      const pair = await this.store.get<OnlineRelationship>(`relationships/${id}`)
      if (!pair?.value.active) throw new OnlineError("not-friends", 409)
      friendship = { id, generation: pair.value.generation }
      const endpoints = await this.store.get<FriendEndpoints>(`realtime/friend-endpoints/${friend}`)
      // Prefer the most recently registered device, skipping closed or revoked sessions.
      // This is resolved only when challenging, never by polling the friend's devices.
      for (const endpoint of [...(endpoints?.value.endpoints ?? [])].reverse()) {
        if (endpoint.expiresAt <= this.now()) continue
        try {
          await this.connection(endpoint.connectionId)
          if (this.delivery.connected && !(await this.delivery.connected(endpoint.connectionId))) continue
          code = endpoint.code
          break
        } catch (error) {
          if (!(error instanceof OnlineError) || error.status !== 401) throw error
        }
      }
      if (!code) throw new OnlineError("endpoint-offline", 409)
    }
    if (
      !["battle", "transfer"].includes(namespace) ||
      !(namespace === "battle" ? /^\d{6}$/ : /^[A-HJ-NP-Z2-9]{16}$/).test(code)
    )
      throw new OnlineError("invalid-endpoint")
    const minute = Math.floor(this.now() / 60_000)
    await change<{ minute: number; count: number }, void>(
      this.store,
      `realtime/open-quotas/${actor.accountId}`,
      () => ({ minute, count: 0 }),
      (value) => {
        if (value.minute !== minute) {
          value.minute = minute
          value.count = 0
        }
        if (value.count >= 30) throw new OnlineError("join-limit", 429)
        value.count++
      },
    )
    const target = await this.store.get<Endpoint>(`realtime/endpoints/${namespace}/${code}`)
    if (!target || target.value.expiresAt <= this.now()) throw new OnlineError("endpoint-offline", 409)
    if (friend !== undefined && target.value.accountId !== friend) throw new OnlineError("endpoint-offline", 409)
    await this.connection(target.value.connectionId)
    if (actor.accountId === target.value.accountId && actor.installationId === target.value.installationId)
      throw new OnlineError("self-connection")
    const ownCode = await this.register(connectionId, namespace)
    const channel = digest(`${actor.accountId}:${actor.installationId}:${requestId}`)
    const key = `realtime/channels/${channel}`
    const link: Link = {
      namespace,
      members: [
        { accountId: actor.accountId, installationId: actor.installationId, connectionId, code: ownCode },
        target.value,
      ],
      expiresAt: this.now() + (friendship ? 120_000 : 15 * 60_000),
      ...(friendship ? { friendship } : {}),
    }
    await change<Link, void>(
      this.store,
      key,
      () => link,
      (value) => {
        const sender = value.members[0],
          recipient = value.members[1]
        if (
          value.namespace !== namespace ||
          JSON.stringify(value.friendship) !== JSON.stringify(friendship) ||
          !sender ||
          !recipient ||
          recipient.code !== code ||
          sender.accountId !== actor.accountId ||
          sender.installationId !== actor.installationId ||
          recipient.accountId !== target.value.accountId ||
          recipient.installationId !== target.value.installationId
        )
          throw new OnlineError("request-conflict", 409)
        if (value.expiresAt <= this.now()) throw new OnlineError("channel-expired", 409)
        // A committed open may have lost its reply before either socket was replaced.
        // Keep the channel identity/deadline while rebinding its original participants.
        sender.connectionId = connectionId
        recipient.connectionId = target.value.connectionId
      },
    )
    await this.delivery.send(target.value.connectionId, { kind: "incoming", namespace, channel, peer: ownCode })
    return channel
  }

  async resume(connectionId: string, channel: string): Promise<void> {
    identifier(channel)
    const actor = await this.connection(connectionId)
    await change<Link, void>(
      this.store,
      `realtime/channels/${channel}`,
      () => {
        throw new OnlineError("channel-expired", 409)
      },
      (link) => {
        if (link.expiresAt <= this.now()) throw new OnlineError("channel-expired", 409)
        const member = link.members.find(
          (item) => item.accountId === actor.accountId && item.installationId === actor.installationId,
        )
        if (!member) throw new OnlineError("forbidden", 403)
        member.connectionId = connectionId
      },
    )
  }

  async relay(connectionId: string, raw: unknown): Promise<void> {
    const connection = await this.connection(connectionId)
    const frame = parseFrame(raw)
    const room = await this.store.get<Link>(`realtime/channels/${frame.channel}`)
    if (!room || room.value.expiresAt <= this.now()) throw new OnlineError("room-expired", 409)
    if (room.value.friendship) {
      const pair = await this.store.get<OnlineRelationship>(`relationships/${room.value.friendship.id}`)
      if (!pair?.value.active || pair.value.generation !== room.value.friendship.generation)
        throw new OnlineError("not-friends", 409)
    }
    if (
      !room.value.members.some(
        (member) =>
          member.accountId === connection.accountId &&
          member.installationId === connection.installationId &&
          member.connectionId === connectionId,
      )
    )
      throw new OnlineError("forbidden", 403)
    const target = room.value.members.find((member) => member.connectionId !== connectionId)
    if (!target) throw new OnlineError("room-not-ready", 409)
    await this.connection(target.connectionId, "peer-offline")
    if (!(await this.delivery.send(target.connectionId, { kind: "frame", frame })))
      throw new OnlineError("peer-offline", 409)
  }
}
