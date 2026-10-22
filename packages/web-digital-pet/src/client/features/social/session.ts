import type { DataConnection } from "peerjs"
import {
  type Envelope,
  type Event,
  type Offer,
  type Profile,
  parseEnvelope,
  parseProfile,
  validAlias,
  validCode,
  validId,
} from "../../../domain/social/model.ts"
import { readArenaFighter } from "../../persistence/arena-store.ts"
import { getDeviceCode, readLocalState, readPendingBattle } from "../../persistence/pet-store.ts"
import {
  abortTrade,
  acknowledgeSocial,
  commitTrade,
  decideFriend,
  prepareTrade,
  queueSocial,
  readSocial,
  receiveSocial,
  resolveTrade,
  updateSocial,
} from "../../persistence/social-store.ts"
import { browserSaveSelected, refreshBrowserViews } from "../../platform/save-source.ts"
import { SocialTransport, socialPeerCode } from "./transport.ts"

type Channel = {
  connection: DataConnection
  outgoing: boolean
  profile?: Profile
  queue: Promise<void>
  seen: number
  timer: number
}
export class SocialSession {
  code = ""
  ready = false
  otherTab = false
  conflict = false
  readonly channels = new Map<string, Channel>()
  private transport: SocialTransport | undefined
  private release: (() => void) | undefined
  private acquiring = false
  private enabled = false
  constructor(
    private changed: () => void,
    private error: (error: unknown) => void,
    private busy: () => boolean,
  ) {}
  async start(): Promise<void> {
    this.code = await getDeviceCode()
    this.enabled = browserSaveSelected()
    await updateSocial((s) => {
      for (const r of Object.values(s.outbox)) if (r.delivery === "sending") r.delivery = "unavailable"
    })
    window.setInterval(() => {
      if (!this.enabled) return
      for (const [code, c] of this.channels) {
        if (Date.now() - c.seen > 45000) {
          c.connection.close()
          this.drop(code, c)
        } else if (c.profile) {
          this.send(c, { type: "ping" })
          void this.hello(c).catch(this.error)
        }
      }
      void this.reconnect().catch(this.error)
    }, 10000)
    window.addEventListener("pagehide", () => this.stop())
    window.addEventListener("pageshow", () => {
      void this.reconnect().catch(this.error)
    })
    window.addEventListener("online", () => {
      void this.reconnect().catch(this.error)
    })
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void this.reconnect().catch(this.error)
    })
    await this.reconnect()
  }
  setEnabled(value: boolean): void {
    this.enabled = value
    if (!value) this.stop()
    else void this.reconnect().catch(this.error)
  }
  get online(): Set<string> {
    return new Set([...this.channels].filter(([, c]) => Boolean(c.profile && c.connection.open)).map(([code]) => code))
  }
  private send(c: Channel, data: unknown): void {
    if (c.connection.open) c.connection.send(data)
  }
  private async hello(c: Channel): Promise<void> {
    const s = await readSocial()
    if (!s.profile || !browserSaveSelected()) return
    const pet = await readLocalState()
    const fighter = await readArenaFighter(pet)
    this.send(c, {
      type: "hello",
      version: 1,
      profile: { ...s.profile, nodeId: pet.currentNodeId, arenaNodeId: fighter.currentNodeId },
    })
  }
  async publishProfile(): Promise<void> {
    for (const channel of this.channels.values()) await this.hello(channel)
  }
  async reconnect(): Promise<void> {
    if (!this.enabled || !browserSaveSelected() || !(await readSocial()).profile) return
    if (!this.transport && !this.acquiring) {
      this.acquiring = true
      const register = () => {
        this.transport = new SocialTransport(this.code, {
          ready: () => {
            this.ready = true
            this.conflict = false
            this.changed()
            void this.reconnect().catch(this.error)
          },
          incoming: (c) => this.bind(c, false),
          conflict: () => {
            this.conflict = true
            this.changed()
          },
          offline: () => {
            this.ready = false
            this.changed()
          },
        })
        this.transport.start()
      }
      if (navigator.locks) {
        void navigator.locks
          .request("digital-pet:social-endpoint", { ifAvailable: true }, async (lock) => {
            if (!lock || !this.enabled) {
              this.acquiring = false
              this.otherTab = !lock
              this.changed()
              return
            }
            this.otherTab = false
            register()
            await new Promise<void>((resolve) => {
              this.release = resolve
            })
          })
          .catch(this.error)
      } else register()
    } else this.transport?.resume()
    if (!this.ready) return
    const s = await readSocial()
    const targets = new Set([
      ...Object.keys(s.friends),
      ...Object.values(s.trades)
        .filter((t) => t.phase === "prepared" || t.phase === "committed")
        .map((t) => t.code),
      ...Object.values(s.outbox)
        .filter((r) => r.state === "pending" && (r.event.kind !== "invite" || r.delivery === "sending"))
        .map((r) => r.code),
    ])
    for (const code of targets) this.connect(code)
    for (const c of this.channels.values()) if (c.profile) await this.flush(c)
  }
  connect(code: string): void {
    if (!this.enabled || !this.ready || !validCode(code) || code === this.code || this.channels.has(code)) return
    try {
      const c = this.transport?.connect(code)
      if (c) this.bind(c, true)
    } catch (error) {
      this.error(error)
    }
  }
  private drop(code: string, c: Channel): void {
    if (this.channels.get(code) !== c) return
    clearTimeout(c.timer)
    this.channels.delete(code)
    void updateSocial((s) => {
      for (const r of Object.values(s.outbox))
        if (r.code === code && r.delivery === "sending") r.delivery = "unavailable"
    })
      .then(this.changed)
      .catch(this.error)
  }
  private bind(connection: DataConnection, outgoing: boolean): void {
    const code = socialPeerCode(connection.peer)
    if (!code || code === this.code || !this.enabled || this.channels.size >= 64) {
      connection.close()
      return
    }
    const old = this.channels.get(code)
    if (old) {
      const preferOutgoing = this.code < code
      if (old.outgoing === preferOutgoing || outgoing !== preferOutgoing) {
        connection.close()
        return
      }
      this.channels.delete(code)
      clearTimeout(old.timer)
      old.connection.close()
    }
    const c: Channel = { connection, outgoing, queue: Promise.resolve(), seen: Date.now(), timer: 0 }
    this.channels.set(code, c)
    c.timer = window.setTimeout(() => {
      if (!c.profile) {
        connection.close()
        this.drop(code, c)
      }
    }, 12000)
    connection.on("open", () => {
      void this.hello(c).catch(this.error)
    })
    connection.on("data", (data) => {
      c.queue = c.queue
        .then(async () => {
          if (this.channels.get(code) === c && this.enabled && browserSaveSelected()) await this.receive(code, c, data)
        })
        .catch((error) => {
          this.error(error)
          connection.close()
          this.drop(code, c)
        })
    })
    connection.on("close", () => this.drop(code, c))
    connection.on("error", () => this.drop(code, c))
  }
  private async receive(code: string, c: Channel, data: unknown): Promise<void> {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      new TextEncoder().encode(JSON.stringify(data)).length > 40000
    )
      throw new Error("social.invalid")
    const m = data as Record<string, unknown>
    if (m.type === "hello") {
      if (m.version !== 1) throw new Error("social.invalid")
      const first = !c.profile
      c.profile = parseProfile(m.profile)
      c.seen = Date.now()
      clearTimeout(c.timer)
      await updateSocial((s) => {
        const f = s.friends[code]
        if (f && c.profile && c.profile.revision >= f.profile.revision) f.profile = c.profile
        if (c.profile)
          for (const r of Object.values(s.outbox)) if (r.code === code && r.state === "pending") r.profile = c.profile
      })
      if (first) await this.flush(c)
      this.changed()
      return
    }
    if (!c.profile) throw new Error("social.invalid")
    c.seen = Date.now()
    if (m.type === "ping") {
      this.send(c, { type: "pong" })
      return
    }
    if (m.type === "pong") return
    if (m.type === "ack" && validId(m.id)) {
      await acknowledgeSocial(code, m.id)
      this.changed()
      return
    }
    if (m.type === "settle" && validId(m.id)) {
      const t = (await readSocial()).trades[m.id]
      if (!t || t.code !== code) throw new Error("social.invalid")
      if (m.stage === "commit" && !t.coordinator) {
        await commitTrade(t.id, code)
        this.send(c, { type: "settle", id: t.id, stage: "applied" })
      } else if (m.stage === "applied" && t.coordinator) {
        await resolveTrade(t.id, code)
        this.send(c, { type: "settle", id: t.id, stage: "complete" })
      } else if (m.stage === "complete" && !t.coordinator) await resolveTrade(t.id, code)
      else if (m.stage === "abort" && !t.coordinator && (t.phase === "prepared" || t.phase === "aborted"))
        await abortTrade(t.id, code)
      else throw new Error("social.invalid")
      refreshBrowserViews()
      this.changed()
      return
    }
    if (m.type !== "event") throw new Error("social.invalid")
    const message = parseEnvelope(m.message)
    await receiveSocial(code, c.profile, message)
    if (message.event.kind === "trade-cancel") {
      const aborted = await abortTrade(message.event.tradeId, code)
      if (!aborted) await this.flush(c)
    }
    if (message.event.kind === "trade-abort-request") {
      const tradeId = message.event.tradeId
      const saved = await readSocial()
      const original = saved.outbox[tradeId]
      if (!original || original.code !== code || original.event.kind !== "trade-offer")
        throw new Error("social.invalid")
      if (await abortTrade(tradeId, code)) this.send(c, { type: "settle", id: tradeId, stage: "abort" })
      else await this.flush(c)
    }
    if (message.event.kind === "trade-ready") {
      const saved = await readSocial()
      if (saved.outbox[message.event.tradeId]?.state === "done" && !saved.trades[message.event.tradeId])
        this.send(c, { type: "settle", id: message.event.tradeId, stage: "abort" })
    }
    this.send(c, { type: "ack", id: message.id })
    this.changed()
  }
  private async flush(c: Channel): Promise<void> {
    const code = socialPeerCode(c.connection.peer)
    if (!code || !c.profile) return
    const s = await readSocial()
    for (const r of Object.values(s.outbox)) {
      if (r.code !== code || r.delivery === "delivered" || r.state !== "pending") continue
      this.send(c, { type: "event", message: { version: 1, id: r.id, event: r.event } satisfies Envelope })
    }
    for (const receipt of Object.values(s.inbox)) {
      if (receipt.code !== code || receipt.event.kind !== "trade-abort-request") continue
      const id = receipt.event.tradeId
      const trade = s.trades[id]
      if (!trade || trade.phase === "aborted") this.send(c, { type: "settle", id, stage: "abort" })
    }
    for (const t of Object.values(s.trades)) {
      if (t.code !== code) continue
      if (t.phase === "aborted") {
        if (t.coordinator) this.send(c, { type: "settle", id: t.id, stage: "abort" })
        continue
      }
      if (t.coordinator && t.phase === "prepared") {
        await commitTrade(t.id, code)
        this.send(c, { type: "settle", id: t.id, stage: "commit" })
      }
      if (t.coordinator && t.phase === "committed") this.send(c, { type: "settle", id: t.id, stage: "commit" })
      if (t.coordinator && t.phase === "resolved") this.send(c, { type: "settle", id: t.id, stage: "complete" })
      if (!t.coordinator && t.phase === "committed") this.send(c, { type: "settle", id: t.id, stage: "applied" })
      if (!t.coordinator && t.phase === "prepared") {
        const ready = Object.values(s.outbox).find((r) => r.event.kind === "trade-ready" && r.event.tradeId === t.id)
        if (ready) this.send(c, { type: "event", message: { version: 1, id: ready.id, event: ready.event } })
      }
    }
  }
  async deliver(id: string): Promise<void> {
    const r = (await readSocial()).outbox[id]
    if (!r) return
    await updateSocial((s) => {
      const entry = s.outbox[id]
      if (entry) entry.delivery = "sending"
    })
    this.connect(r.code)
    const c = this.channels.get(r.code)
    if (c?.profile) await this.flush(c)
    window.setTimeout(() => {
      void updateSocial((s) => {
        const entry = s.outbox[id]
        if (entry?.delivery === "sending") entry.delivery = "unavailable"
      })
        .then(this.changed)
        .catch(this.error)
    }, 12000)
    this.changed()
  }
  async sendEvent(code: string, event: Event, displayAlias?: string): Promise<string> {
    if (code === this.code) throw new Error("social.self")
    const id = await queueSocial(code, event)
    if (event.kind === "invite")
      await updateSocial((s) => {
        const r = s.outbox[id]
        if (r)
          r.profile = this.channels.get(code)?.profile ?? {
            alias: validAlias(displayAlias) ? displayAlias : "PLAYER",
            revision: 0,
            nodeId: null,
          }
      })
    await this.deliver(id)
    return id
  }
  async decide(id: string, accepted: boolean): Promise<void> {
    const r = await decideFriend(id, accepted)
    await this.deliver(r.id)
  }
  async readyTrade(id: string, local: Offer): Promise<void> {
    if (this.busy() || !browserSaveSelected() || (await readPendingBattle())) throw new Error("social.busy")
    const s = await readSocial()
    const r = s.inbox[id]
    if (!r || r.state !== "pending" || r.event.kind !== "trade-offer" || !this.online.has(r.code))
      throw new Error("social.offline")
    await prepareTrade({
      id,
      code: r.code,
      coordinator: false,
      local,
      remote: r.event.offer,
      phase: "prepared",
      played: false,
    })
    const prepared = await readSocial()
    const ready = Object.values(prepared.outbox).find(
      (entry) => entry.event.kind === "trade-ready" && entry.event.tradeId === id,
    )
    if (ready) await this.deliver(ready.id)
  }
  async confirmTrade(readyId: string): Promise<void> {
    if (this.busy() || !browserSaveSelected()) throw new Error("social.busy")
    const s = await readSocial()
    const r = s.inbox[readyId]
    if (!r || r.state !== "pending" || r.event.kind !== "trade-ready" || !this.online.has(r.code))
      throw new Error("social.offline")
    const original = s.outbox[r.event.tradeId]
    if (!original || original.state !== "pending" || original.event.kind !== "trade-offer")
      throw new Error("social.invalid")
    try {
      await prepareTrade({
        id: original.id,
        code: r.code,
        coordinator: true,
        local: original.event.offer,
        remote: r.event.offer,
        phase: "prepared",
        played: false,
      })
    } catch (error) {
      if (await abortTrade(original.id, r.code))
        await this.sendEvent(r.code, { kind: "trade-cancel", tradeId: original.id })
      throw error
    }
    await commitTrade(original.id, r.code)
    const c = this.channels.get(r.code)
    if (c) await this.flush(c)
    this.changed()
  }
  stop(): void {
    for (const [code, c] of this.channels) {
      c.connection.close()
      this.drop(code, c)
    }
    this.transport?.stop()
    this.transport = undefined
    this.ready = false
    this.acquiring = false
    this.release?.()
    this.release = undefined
    this.changed()
  }
}
