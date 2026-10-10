import Peer, { type DataConnection } from "peerjs"
import { IntlModule } from "../../../shared/i18n.ts"
import { PeerRetry } from "../../platform/peer-retry.ts"

const PREFIX = "web-digital-pet-battle-v1-"
export const validBattleCode = (value: string): boolean => /^\d{6}$/.test(value)
export const battleCodeOf = (connection: DataConnection): string => connection.peer.slice(PREFIX.length)
const newCode = (): string => {
  const limit = Math.floor(4294967296 / 1_000_000) * 1_000_000
  let value: number
  do {
    value = new DataView(crypto.getRandomValues(new Uint8Array(4)).buffer).getUint32(0)
  } while (value >= limit)
  return String(value % 1_000_000).padStart(6, "0")
}

type Listeners = {
  readonly ready: (code: string) => void
  readonly incoming: (connection: DataConnection) => void
  readonly disconnected: () => void
  readonly error: (message: string) => void
}

/** A short code belongs to this live page, separately from the persistent save-transfer identity. */
export class BattleTransport {
  private peer: Peer | undefined
  private stopped = false
  private attempts = 0
  private readonly retry = new PeerRetry(() => this.resume())
  code = ""

  constructor(private readonly listeners: Listeners) {
    this.register()
  }

  private register(): void {
    this.code = newCode()
    const peer = new Peer(`${PREFIX}${this.code}`)
    this.peer = peer
    peer.on("open", () => {
      if (!this.stopped && this.peer === peer) {
        this.retry.reset()
        this.listeners.ready(this.code)
      }
    })
    peer.on("connection", (connection) => {
      if (
        this.stopped ||
        this.peer !== peer ||
        !connection.peer.startsWith(PREFIX) ||
        !validBattleCode(battleCodeOf(connection))
      )
        connection.close()
      else this.listeners.incoming(connection)
    })
    peer.on("disconnected", () => {
      if (this.stopped || this.peer !== peer) return
      this.listeners.disconnected()
      this.retry.schedule()
    })
    peer.on("error", (error) => {
      if (this.stopped || this.peer !== peer) return
      if (error.type === "unavailable-id" && ++this.attempts < 10) {
        peer.destroy()
        this.register()
      } else {
        this.listeners.error(error.message)
        if (["network", "server-error", "socket-error", "socket-closed"].includes(error.type)) this.retry.schedule()
      }
    })
  }

  connect(code: string): DataConnection {
    if (!validBattleCode(code) || !this.peer?.open)
      throw new Error(IntlModule.translate("transport.theBattleServiceIsNotReady"))
    return this.peer.connect(`${PREFIX}${code}`, { serialization: "json", reliable: true })
  }

  get connected(): boolean {
    return this.peer?.open ?? false
  }

  /** Safari can restore a page whose peer was destroyed on pagehide. */
  resume(): void {
    this.retry.stop()
    this.stopped = false
    if (!this.peer || this.peer.destroyed) {
      this.attempts = 0
      this.register()
    } else if (this.peer.disconnected) this.peer.reconnect()
  }

  stop(): void {
    this.stopped = true
    this.retry.stop()
    this.peer?.destroy()
  }
}
