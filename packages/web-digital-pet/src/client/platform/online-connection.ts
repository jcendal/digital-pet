import { record, type WireFrame } from "@jcendal/digital-pet-online/contracts.ts"
import { OrderedChannel } from "@jcendal/digital-pet-online/ordered-channel.ts"

/** Logical, ordered delivery; the socket itself may reconnect between messages. */
export class OnlineConnection {
  open = false
  channel = ""
  private ordered?: OrderedChannel
  private listeners = new Map<string, ((value: never) => void | Promise<void>)[]>()
  private assembly = ""
  private parts = 0
  private total = 0
  private closing = false
  private ended = false
  private closeTimer?: number
  private progressAt = 0
  constructor(
    readonly peer: string,
    private write: (frame: WireFrame) => void,
    private endedCallback: () => void,
  ) {}
  on(event: "open" | "close", listener: () => void): this
  on(event: "data", listener: (value: unknown) => void | Promise<void>): this
  on(event: "error", listener: (error: Error) => void): this
  on(event: string, listener: (value: never) => void | Promise<void>): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
    return this
  }
  private async emit(event: string, value?: unknown): Promise<void> {
    for (const listener of this.listeners.get(event) ?? []) await listener(value as never)
  }
  activate(channel: string): void {
    if (this.ended || this.ordered) return
    this.channel = channel
    this.ordered = new OrderedChannel(channel, this.write, async (raw) => {
      const message = record(raw)
      if (message.kind === "finish") {
        this.close()
        return
      }
      if (
        message.kind !== "part" ||
        typeof message.text !== "string" ||
        !Number.isInteger(message.index) ||
        !Number.isInteger(message.total) ||
        (message.total as number) < 1 ||
        (message.total as number) > 24 ||
        (message.index as number) !== this.parts
      )
        throw new Error("invalid-message")
      if (this.parts === 0) this.total = message.total as number
      if (
        this.total !== message.total ||
        message.text.length > 6000 ||
        this.assembly.length + message.text.length > 128 * 1024
      )
        throw new Error("message-too-large")
      const joined = this.assembly + message.text
      if (this.parts + 1 === this.total) {
        // Leave the previous assembly intact until application persistence succeeds.
        await this.emit("data", JSON.parse(joined))
        this.parts = 0
        this.total = 0
        this.assembly = ""
      } else {
        this.assembly = joined
        this.parts++
      }
    })
    this.open = true
    if (this.closing) {
      this.ordered.send({ kind: "finish" })
      return
    }
    void this.emit("open").catch((error) => this.fail(error))
  }
  send(value: unknown): void {
    if (!this.ordered || !this.open || this.closing) throw new Error("channel-closed")
    const json = JSON.stringify(value)
    if (new TextEncoder().encode(json).byteLength > 96 * 1024) throw new Error("message-too-large")
    const total = Math.ceil(json.length / 6000)
    if (this.ordered.pending === 0) this.progressAt = Date.now()
    for (let index = 0; index < total; index++)
      this.ordered.send({ kind: "part", index, total, text: json.slice(index * 6000, (index + 1) * 6000) })
  }
  async receive(frame: WireFrame): Promise<void> {
    const pending = this.ordered?.pending ?? 0
    await this.ordered?.receive(frame)
    if ((this.ordered?.pending ?? 0) < pending) this.progressAt = Date.now()
    this.finishIfDrained()
  }
  resend(): void {
    if (this.ordered?.pending && !this.closing && Date.now() - this.progressAt >= 30_000) {
      this.fail(new Error("delivery-timeout"))
      return
    }
    this.ordered?.resend()
    this.finishIfDrained()
  }
  close(): void {
    if (this.closing || this.ended) return
    this.closing = true
    if (this.ordered) {
      this.ordered.send({ kind: "finish" })
      this.closeTimer = window.setTimeout(() => this.finish(), 30_000)
      this.finishIfDrained()
    } else this.closeTimer = window.setTimeout(() => this.finish(), 30_000)
  }
  private finishIfDrained(): void {
    if (this.closing && this.ordered?.pending === 0) this.finish()
  }
  private finish(graceful = true): void {
    if (this.ended) return
    this.ended = true
    this.open = false
    window.clearTimeout(this.closeTimer)
    if (!graceful) {
      this.ordered?.close()
      this.endedCallback()
      void this.emit("close")
      return
    }
    // Keep the ordered channel alive briefly to acknowledge a retransmitted final frame.
    window.setTimeout(() => {
      this.ordered?.close()
      this.endedCallback()
    }, 30_000)
    void this.emit("close")
  }
  fail(error: unknown): void {
    void this.emit("error", error instanceof Error ? error : new Error("connection-failed"))
    this.finish(false)
  }
}
