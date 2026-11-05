import { record } from "@jcendal/digital-pet-online/contracts.ts"
import type { SocialCommand } from "@jcendal/digital-pet-online/social-commands.ts"
import { api, currentOnlineSession, onlineConfigured, onlineContext, onlineSocketUrl } from "./online-api.ts"
import { announceOnline } from "./online-events.ts"
import { installSocialSender } from "./online-rpc.ts"

export interface WireListener {
  opened(): void
  disconnected(): void
  reset(): void
  receive(value: Record<string, unknown>): Promise<void>
  resend(): void
  error(message: string): void
}
type Request = { resolve: (response: Response) => void; reject: (error: Error) => void; timer: number }

/** One physical connection and one browser lock, multiplexing feature protocols. */
class OnlineWire {
  private socket: WebSocket | undefined
  private listeners = new Set<WireListener>()
  private registered = new Set<WireListener>()
  private requests = new Map<string, Request>()
  private notices = new Set<string>()
  private connecting = false
  private suspended = false
  private epoch = 0
  private attempt = 0
  private timer?: number
  private maintenance?: number
  private sessionDeadline?: number
  private releaseLock: (() => void) | undefined
  constructor() {
    installSocialSender((account, command) => this.request(account, command))
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
    for (const name of ["online", "digital-pet:online-released"]) window.addEventListener(name, () => this.resume())
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause()
      else this.resume()
    })
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
    if (!this.listeners.size) this.pause()
  }
  ready(listener: WireListener): void {
    this.registered.add(listener)
    if ([...this.listeners].every((item) => this.registered.has(item))) this.attempt = 0
  }
  reconnect(): void {
    this.pause()
    this.schedule()
  }
  write(value: unknown): void {
    if (this.connected) this.socket!.send(JSON.stringify(value))
  }
  private request(accountId: string, command: SocialCommand): Promise<Response> | undefined {
    if (!this.connected) return
    const requestId = crypto.randomUUID()
    const message = { action: "social", requestId, accountId, command }
    if (new TextEncoder().encode(JSON.stringify(message)).byteLength > 24 * 1024) return
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.requests.delete(requestId)
        reject(new Error("online.offline"))
      }, 25_000)
      this.requests.set(requestId, { resolve, reject, timer })
      this.write(message)
    })
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
      !this.listeners.size ||
      document.hidden ||
      !navigator.onLine ||
      !onlineConfigured()
    )
      return
    this.connecting = true
    const epoch = this.epoch
    try {
      if (!(await this.acquire())) {
        // A just-released page lock may still be settling. This retry is local only.
        this.schedule()
        return
      }
      if (this.suspended || epoch !== this.epoch || !this.listeners.size || document.hidden) return
      const context = await onlineContext()
      if (this.suspended || epoch !== this.epoch || !this.listeners.size || document.hidden) return
      const ticket = await api<{ ticket: string }>(
        "/auth/ticket",
        "POST",
        { installationId: context.installationId },
        context.accountId,
      )
      if (this.suspended || epoch !== this.epoch || !this.listeners.size || document.hidden) return
      const url = new URL(onlineSocketUrl())
      url.searchParams.set("ticket", ticket.ticket)
      const socket = new WebSocket(url)
      this.socket = socket
      socket.onopen = () => {
        if (socket !== this.socket) return
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
        this.pause()
        this.schedule()
      }
      socket.onerror = () => socket.close()
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
    if (value.kind === "response" && typeof value.requestId === "string" && typeof value.status === "number") {
      const request = this.requests.get(value.requestId)
      if (!request) return
      this.requests.delete(value.requestId)
      window.clearTimeout(request.timer)
      request.resolve(
        new Response(JSON.stringify(value.body), {
          status: value.status,
          headers: { "Content-Type": "application/json" },
        }),
      )
      return
    }
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
    if (!this.suspended && !document.hidden && navigator.onLine && this.listeners.size)
      this.timer = window.setTimeout(() => this.resume(), Math.min(30_000, 1000 * 2 ** Math.min(this.attempt++, 5)))
  }
  private pause(): void {
    this.epoch++
    this.registered.clear()
    window.clearTimeout(this.timer)
    window.clearInterval(this.maintenance)
    window.clearTimeout(this.sessionDeadline)
    const socket = this.socket
    this.socket = undefined
    socket?.close()
    this.release()
    for (const request of this.requests.values()) {
      window.clearTimeout(request.timer)
      request.reject(new Error("online.offline"))
    }
    this.requests.clear()
    for (const listener of this.listeners) listener.disconnected()
  }
}
export const onlineWire = new OnlineWire()
