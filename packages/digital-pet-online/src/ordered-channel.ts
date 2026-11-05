import { MAX_PENDING_MESSAGES, OnlineError, parseFrame, type WireFrame } from "./contracts.ts"

/** Ordering belongs to a logical channel, not an AWS socket connection. */
export class OrderedChannel {
  private nextOutgoing = 1
  private nextIncoming = 1
  private readonly outgoing = new Map<number, WireFrame>()
  private readonly incoming = new Map<number, Extract<WireFrame, { kind: "data" }>>()
  private processing: Promise<void> = Promise.resolve()
  private closed = false

  constructor(
    readonly id: string,
    private readonly write: (frame: WireFrame) => void,
    private readonly deliver: (payload: unknown) => Promise<void>,
  ) {}

  send(payload: unknown): void {
    if (this.closed) throw new OnlineError("channel-closed", 409)
    if (this.outgoing.size >= MAX_PENDING_MESSAGES) throw new OnlineError("channel-full", 429)
    const frame = parseFrame({ version: 1, channel: this.id, kind: "data", sequence: this.nextOutgoing, payload })
    this.nextOutgoing++
    this.outgoing.set(frame.sequence, frame)
    this.write(frame)
  }

  receive(input: unknown): Promise<void> {
    const task = this.processing.then(() => this.process(parseFrame(input)))
    // A failed consumer must be retryable and must never acknowledge unapplied data.
    this.processing = task.catch(() => {})
    return task
  }

  private async process(frame: WireFrame): Promise<void> {
    if (this.closed || frame.channel !== this.id) throw new OnlineError("wrong-channel", 409)
    if (frame.kind === "ack") {
      this.outgoing.delete(frame.sequence)
      return
    }
    if (frame.sequence < this.nextIncoming) {
      this.acknowledge(frame.sequence)
      return
    }
    if (frame.sequence - this.nextIncoming >= MAX_PENDING_MESSAGES) throw new OnlineError("sequence-gap", 409)
    const previous = this.incoming.get(frame.sequence)
    if (previous && JSON.stringify(previous.payload) !== JSON.stringify(frame.payload))
      throw new OnlineError("sequence-conflict", 409)
    this.incoming.set(frame.sequence, frame)
    for (;;) {
      const next = this.incoming.get(this.nextIncoming)
      if (!next) break
      await this.deliver(next.payload)
      this.incoming.delete(this.nextIncoming)
      this.nextIncoming++
      this.acknowledge(next.sequence)
    }
  }

  private acknowledge(sequence: number): void {
    this.write({ version: 1, channel: this.id, kind: "ack", sequence })
  }

  /** Call after reconnect and on a bounded retry timer. Duplicate frames are safe. */
  resend(): void {
    if (!this.closed) for (const frame of this.outgoing.values()) this.write(frame)
  }

  get pending(): number {
    return this.outgoing.size
  }

  close(): void {
    this.closed = true
    this.outgoing.clear()
    this.incoming.clear()
  }
}
