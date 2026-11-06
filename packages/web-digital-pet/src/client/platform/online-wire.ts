import { record } from "@jcendal/digital-pet-online/contracts.ts"
import ReconnectingWebSocket from "partysocket/ws"
import { api, currentOnlineSession, onlineConfigured, onlineContext, onlineSocketUrl } from "./online-api.ts"
import { announceOnline } from "./online-events.ts"
import { OnlineRequests } from "./online-requests.ts"
import { installSocialSender } from "./online-rpc.ts"

export interface WireListener {
  opened(): void
  disconnected(): void
  reset(): void
  receive(value: Record<string, unknown>): Promise<void>
  resend(): void
  error(message: string): void
}

/** One physical connection and one browser lock, multiplexing feature protocols. */
class OnlineWire {
  private socket: ReconnectingWebSocket | undefined
  private listeners = new Set<WireListener>()
  private registered = new Set<WireListener>()
  private requests = new OnlineRequests({
    connected: () => this.connected,
    account: () => currentOnlineSession()?.accountId,
    send: (value) => this.write(value),
    resume: () => this.resume(),
  })
  private notices = new Set<string>()
  private connecting = false
  private waitingForLock = false
  private suspended = false
  private epoch = 0
  private attempt = 0
  private timer?: number
  private maintenance?: number
  private sessionDeadline?: number
  private releaseLock: (() => void) | undefined
  constructor() {
    installSocialSender((account, command) => this.requests.request(account, command))
    window.addEventListener("digital-pet:account-changed", () => {
      this.pause()
      this.notices.clear()
      for (const listener of this.listeners) listener.reset()
      this.resume()
    })
    window.addEventListener("digital-pet:session-renewed", () => {
      this.pause()
      this.resume()
    })
    window.addEventListener("pagehide", () => {
      this.suspended = true
      this.pause()
    })
    window.addEventListener("pageshow", () => {
      this.suspended = false
      this.resume()
    })
    window.addEventListener("offline", () => this.pause())
    for (const name of ["online", "digital-pet:online-released"]) window.addEventListener(name, () => this.resume())
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause()
      else this.resume()
    })
  }
  get waitingForConnection(): boolean {
    return this.waitingForLock
  }
  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }
  attach(listener: WireListener): void {
    if (this.listeners.has(listener)) {
      this.resume()
      return
    }
    this.listeners.add(listener)
    if (this.connected) listener.opened()
    else this.resume()
  }
  detach(listener: WireListener): void {
    this.listeners.delete(listener)
    this.registered.delete(listener)
    if (!this.wanted) this.pause()
  }
  private get wanted(): boolean {
    return this.listeners.size > 0 || this.requests.size > 0
  }
  ready(listener: WireListener): void {
    this.registered.add(listener)
    if ([...this.listeners].every((item) => this.registered.has(item))) this.attempt = 0
  }
  reconnect(): void {
    const socket = this.socket
    if (!socket) {
      this.resume()
      return
    }
    // A transport can be open while its feature handshake fails. Back off these
    // explicit protocol restarts too; PartySocket owns unexpected network closes.
    socket.close()
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      if (socket === this.socket) socket.reconnect()
    }, this.retryDelay())
  }
  write(value: unknown): boolean {
    return this.connected ? this.socket!.send(JSON.stringify(value)) : false
  }
  private async acquire(): Promise<boolean> {
    if (!navigator.locks) return true
    return new Promise((resolve) => {
      void navigator.locks
        .request("digital-pet:online-wire", { ifAvailable: true }, async (lock) => {
          if (!lock) {
            resolve(false)
            return
          }
          const held = new Promise<void>((release) => {
            this.releaseLock = release
          })
          resolve(true)
          await held
        })
        .catch(() => resolve(false))
    })
  }
  private release(): void {
    const held = Boolean(this.releaseLock)
    this.releaseLock?.()
    this.releaseLock = undefined
    if (held) announceOnline("online-released", undefined, false)
  }
  resume(): void {
    void this.start()
  }
  private async start(): Promise<void> {
    if (
      this.suspended ||
      this.connecting ||
      this.socket ||
      !this.wanted ||
      document.hidden ||
      !navigator.onLine ||
      !onlineConfigured()
    )
      return
    this.connecting = true
    const epoch = this.epoch
    try {
      if (!(await this.acquire())) {
        this.waitingForLock = true
        window.dispatchEvent(new Event("digital-pet:online-ownership"))
        // A just-released page lock may still be settling. This retry is local only.
        this.schedule()
        return
      }
      this.waitingForLock = false
      window.dispatchEvent(new Event("digital-pet:online-ownership"))
      if (this.suspended || epoch !== this.epoch || !this.wanted || document.hidden) return
      const active = () =>
        !this.suspended && epoch === this.epoch && this.wanted && !document.hidden && navigator.onLine
      const socket = new ReconnectingWebSocket(
        async () => {
          try {
            if (!active()) throw new Error("online.offline")
            const context = await onlineContext()
            if (!active()) throw new Error("online.offline")
            const ticket = await api<{ ticket: string }>(
              "/auth/ticket",
              "POST",
              { installationId: context.installationId },
              context.accountId,
            )
            if (!active()) throw new Error("online.offline")
            const url = new URL(onlineSocketUrl())
            url.searchParams.set("ticket", ticket.ticket)
            return url.href
          } catch (error) {
            if (
              socket === this.socket &&
              error instanceof Error &&
              ["online.signIn", "online.adoptFirst"].includes(error.message)
            )
              this.pause()
            throw error
          }
        },
        [],
        {
          startClosed: true,
          maxEnqueuedMessages: 0,
          connectionTimeout: 10_000,
          minReconnectionDelay: 1000 + Math.random() * 2000,
          maxReconnectionDelay: 30_000,
          reconnectionDelayGrowFactor: 2,
          minUptime: 10_000,
        },
      )
      this.socket = socket
      socket.onopen = () => {
        if (socket !== this.socket) return
        this.requests.opened()
        const expiresAt = currentOnlineSession()?.accessExpiresAt
        if (expiresAt)
          this.sessionDeadline = window.setTimeout(
            () => {
              this.pause()
              this.resume()
            },
            Math.max(0, expiresAt - Date.now() - 60_000),
          )
        for (const listener of this.listeners) listener.opened()
        // Retransmit only outstanding operations. No registration or heartbeat messages.
        this.maintenance = window.setInterval(() => {
          for (const listener of this.listeners) listener.resend()
        }, 3000)
      }
      socket.onmessage = (event) => {
        if (socket !== this.socket || typeof event.data !== "string" || event.data.length > 26 * 1024) return
        void Promise.resolve()
          .then(() => this.receive(record(JSON.parse(event.data))))
          .catch((error: unknown) => {
            for (const listener of this.listeners)
              listener.error(error instanceof Error ? error.message : "invalid-message")
          })
      }
      socket.onclose = () => {
        if (socket !== this.socket) return
        this.disconnected()
      }
      // PartySocket owns retries; destroying it here would reset its backoff.
      socket.onerror = () => {
        if (socket === this.socket) this.disconnected()
      }
      socket.reconnect()
    } catch (error) {
      if (!(error instanceof Error && ["online.signIn", "online.adoptFirst"].includes(error.message))) {
        for (const listener of this.listeners)
          listener.error(error instanceof Error ? error.message : "connection-failed")
        this.schedule()
      }
    } finally {
      if (!this.socket) this.release()
      this.connecting = false
      if (epoch !== this.epoch && !this.socket) this.resume()
    }
  }
  private async receive(value: Record<string, unknown>): Promise<void> {
    if (value.kind === "error" && !value.channel && !value.requestId) {
      for (const listener of this.listeners) listener.error(String(value.error))
      this.reconnect()
      return
    }
    if (this.requests.receive(value)) return
    if (
      value.kind === "changed" &&
      typeof value.eventId === "string" &&
      ["social", "battle"].includes(String(value.topic))
    ) {
      if (this.notices.has(value.eventId)) return
      this.notices.add(value.eventId)
      if (this.notices.size > 256) this.notices.delete(this.notices.values().next().value!)
      announceOnline(value.topic === "battle" ? "online-battle" : "online-social", value.eventId)
      return
    }
    await Promise.all([...this.listeners].map((listener) => listener.receive(value)))
  }
  private schedule(): void {
    window.clearTimeout(this.timer)
    if (!this.suspended && !document.hidden && navigator.onLine && this.wanted)
      this.timer = window.setTimeout(() => this.resume(), this.retryDelay())
  }
  private retryDelay(): number {
    return Math.min(30_000, (1000 + Math.random() * 1000) * 2 ** Math.min(this.attempt++, 5))
  }
  private disconnected(): void {
    window.dispatchEvent(new Event("digital-pet:online-disconnected"))
    this.registered.clear()
    window.clearInterval(this.maintenance)
    window.clearTimeout(this.sessionDeadline)
    this.requests.disconnected()
    for (const listener of this.listeners) listener.disconnected()
  }
  private pause(): void {
    this.waitingForLock = false
    this.epoch++
    window.clearTimeout(this.timer)
    const socket = this.socket
    this.socket = undefined
    socket?.close()
    this.release()
    this.disconnected()
  }
}
export const onlineWire = new OnlineWire()
