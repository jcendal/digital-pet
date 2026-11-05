import { parseFrame } from "@jcendal/digital-pet-online/contracts.ts"
import { OnlineConnection } from "./online-connection.ts"
import { announceOnline } from "./online-events.ts"
import { onlineWire, type WireListener } from "./online-wire.ts"

type Listeners = {
  ready: (code: string) => void
  incoming: (connection: OnlineConnection) => void
  disconnected: () => void
  error: (message: string) => void
}
type Pending = { connection: OnlineConnection; requestId: string; code: string; attempts: number }
/** Feature-level logical channels; physical transport is owned exclusively by OnlineWire. */
export class OnlineEndpoint implements WireListener {
  code = ""
  private wanted = true
  private registrations = 0
  private links = new Map<string, OnlineConnection>()
  private pending = new Map<string, Pending>()
  private resuming = new Map<string, number>()
  constructor(
    private namespace: "battle" | "transfer",
    private prefix: string,
    private listeners: Listeners,
  ) {
    this.resume()
  }
  get connected(): boolean {
    return onlineWire.connected && !!this.code
  }
  private write(value: unknown): void {
    onlineWire.write(value)
  }
  opened(): void {
    this.registrations = 0
    this.register()
    this.resuming.clear()
    for (const channel of this.links.keys()) this.resumeLink(channel)
    for (const entry of this.pending.values()) this.request(entry)
  }
  private register(): void {
    this.registrations++
    this.write({ action: "register", namespace: this.namespace, requestId: `register:${this.namespace}` })
  }
  disconnected(): void {
    this.code = ""
    this.listeners.disconnected()
  }
  error(message: string): void {
    this.listeners.error(message)
  }
  private resumeLink(channel: string): void {
    const attempts = this.resuming.get(channel) ?? 0
    if (attempts >= 3) {
      this.resuming.delete(channel)
      this.links.get(channel)?.fail(new Error("resume-timeout"))
      return
    }
    this.resuming.set(channel, attempts + 1)
    this.write({ action: "resume", channel })
  }
  resend(): void {
    if (!onlineWire.connected) return
    if (!this.code) {
      if (this.registrations >= 3) {
        this.error("registration-timeout")
        onlineWire.reconnect()
        return
      }
      this.register()
    }
    for (const channel of this.resuming.keys()) this.resumeLink(channel)
    for (const [channel, link] of this.links) if (!this.resuming.has(channel)) link.resend()
    for (const entry of this.pending.values()) this.request(entry)
  }
  private connection(code: string): OnlineConnection {
    const link = new OnlineConnection(
      `${this.prefix}${code}`,
      (frame) => this.write({ action: "relay", frame }),
      () => {
        for (const [key, value] of this.links)
          if (value === link) {
            this.links.delete(key)
            this.resuming.delete(key)
          }
        for (const [key, value] of this.pending) if (value.connection === link) this.pending.delete(key)
        if (!this.wanted && !this.links.size && !this.pending.size) this.stop()
      },
    )
    return link
  }
  private request(entry: Pending): void {
    if (entry.attempts++ >= 30) {
      this.pending.delete(entry.requestId)
      entry.connection.fail(new Error("connection-timeout"))
      return
    }
    this.write({ action: "open", namespace: this.namespace, code: entry.code, requestId: entry.requestId })
  }
  async receive(value: Record<string, unknown>): Promise<void> {
    if (value.kind === "registered" && value.namespace === this.namespace && typeof value.code === "string") {
      if (this.code === value.code) return
      this.code = value.code
      onlineWire.ready(this)
      this.listeners.ready(this.code)
      if (this.namespace === "battle") announceOnline("online-ready")
    } else if (value.kind === "opened" && typeof value.channel === "string" && typeof value.requestId === "string") {
      const entry = this.pending.get(value.requestId)
      if (!entry) return
      this.pending.delete(value.requestId)
      this.links.set(value.channel, entry.connection)
      entry.connection.activate(value.channel)
    } else if (
      value.kind === "incoming" &&
      value.namespace === this.namespace &&
      typeof value.channel === "string" &&
      typeof value.peer === "string"
    ) {
      if (this.links.has(value.channel)) return
      const link = this.connection(value.peer)
      this.links.set(value.channel, link)
      this.listeners.incoming(link)
      link.activate(value.channel)
    } else if (value.kind === "frame") {
      const frame = parseFrame(value.frame)
      await this.links.get(frame.channel)?.receive(frame)
    } else if (value.kind === "resumed" && typeof value.channel === "string") {
      this.resuming.delete(value.channel)
      this.links.get(value.channel)?.resend()
    } else if (value.kind === "error") {
      if (typeof value.channel === "string") {
        if (value.retryable !== true) {
          this.resuming.delete(value.channel)
          this.links.get(value.channel)?.fail(new Error(String(value.error)))
        }
        return
      }
      if (value.requestId === `register:${this.namespace}`) this.error(String(value.error))
      const entry = typeof value.requestId === "string" ? this.pending.get(value.requestId) : undefined
      if (entry) {
        if (value.retryable === true) return
        this.pending.delete(entry.requestId)
        entry.connection.fail(new Error(String(value.error)))
      }
    }
  }
  connect(code: string): OnlineConnection {
    if (!this.connected) throw new Error("online.signIn")
    const connection = this.connection(code)
    const entry = { connection, code, requestId: crypto.randomUUID(), attempts: 0 }
    this.pending.set(entry.requestId, entry)
    this.request(entry)
    return connection
  }
  resume(): void {
    this.wanted = true
    onlineWire.attach(this)
  }
  reset(): void {
    for (const link of this.links.values()) link.fail(new Error("account-changed"))
    for (const entry of this.pending.values()) entry.connection.fail(new Error("account-changed"))
    this.resuming.clear()
    this.links.clear()
    this.pending.clear()
  }
  stop(): void {
    this.wanted = false
    onlineWire.detach(this)
    this.disconnected()
  }
}
