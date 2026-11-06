import { jsonBytes, MAX_FRAME_BYTES } from "@jcendal/digital-pet-online/contracts.ts"
import type { SocialCommand } from "@jcendal/digital-pet-online/social-commands.ts"
import { MAX_SOCKET_REQUEST_BYTES, SocketAssembly, socketParts } from "@jcendal/digital-pet-online/socket-rpc.ts"
import PQueue from "p-queue"

type Pending = {
  resolve(response: Response): void
  reject(error: unknown): void
  assembly: SocketAssembly
  status?: number
}
export interface RequestTransport {
  connected(): boolean
  account(): string | undefined
  send(value: unknown): boolean
  resume(): void
}

/** Correlate replies and bound work. Neither disconnects nor deadlines replay commands. */
export class OnlineRequests {
  private queue = new PQueue({ concurrency: 4 })
  private controllers = new Set<AbortController>()
  private waiting = new Set<() => void>()
  private pending = new Map<string, Pending>()
  constructor(
    private readonly transport: RequestTransport,
    private readonly timeout = 25_000,
  ) {}
  get size(): number {
    return this.controllers.size
  }
  opened(): void {
    for (const ready of this.waiting) ready()
  }
  disconnected(): void {
    for (const controller of this.controllers) controller.abort(new Error("online.offline"))
  }
  async request(accountId: string, command: SocialCommand): Promise<Response> {
    if (this.size >= 32) throw new Error("online.offline")
    const controller = new AbortController()
    this.controllers.add(controller)
    const signal = controller.signal
    const timer = setTimeout(() => controller.abort(new Error("online.offline")), this.timeout)
    const requestId = crypto.randomUUID()
    try {
      return await this.queue.add(
        async () => {
          await this.ready(signal)
          signal.throwIfAborted()
          if (this.transport.account() !== accountId) throw new Error("online.saveChanged")
          const message = { action: "social", requestId, accountId, command, responseChunks: true }
          const frames =
            jsonBytes(message) <= MAX_FRAME_BYTES
              ? [message]
              : socketParts(command, MAX_SOCKET_REQUEST_BYTES).map((fragment) => ({
                  action: "social",
                  requestId,
                  accountId,
                  responseChunks: true,
                  fragment,
                }))
          return new Promise<Response>((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject, assembly: new SocketAssembly() })
            for (const frame of frames) {
              if (!this.transport.send(frame)) {
                reject(new Error("online.offline"))
                break
              }
            }
          })
        },
        { signal },
      )
    } finally {
      clearTimeout(timer)
      this.pending.delete(requestId)
      this.controllers.delete(controller)
    }
  }
  receive(value: Record<string, unknown>): boolean {
    if (value.kind !== "response" && value.kind !== "response-part") return false
    if (typeof value.requestId !== "string") return true
    const pending = this.pending.get(value.requestId)
    if (!pending) return true
    try {
      if (
        !Number.isInteger(value.status) ||
        Number(value.status) < 200 ||
        Number(value.status) > 599 ||
        (pending.status !== undefined && pending.status !== value.status)
      )
        throw new Error("online.invalid")
      pending.status = Number(value.status)
      const source = value.kind === "response-part" ? pending.assembly.add(value.fragment) : JSON.stringify(value.body)
      if (source === undefined) return true
      // Validate the assembled JSON before resolving the application boundary.
      JSON.parse(source)
      pending.resolve(new Response(source, { status: pending.status, headers: { "Content-Type": "application/json" } }))
      this.pending.delete(value.requestId)
    } catch (error) {
      pending.reject(error)
      this.pending.delete(value.requestId)
    }
    return true
  }
  private ready(signal: AbortSignal): Promise<void> {
    if (this.transport.connected()) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.waiting.delete(ready)
        signal.removeEventListener("abort", abort)
      }
      const ready = () => {
        cleanup()
        resolve()
      }
      const abort = () => {
        cleanup()
        reject(signal.reason)
      }
      this.waiting.add(ready)
      signal.addEventListener("abort", abort, { once: true })
      if (signal.aborted) abort()
      else this.transport.resume()
    })
  }
}
