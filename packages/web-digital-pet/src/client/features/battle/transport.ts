import Peer, { type DataConnection } from "peerjs"
import { IntlModule } from "../../../shared/i18n.ts"

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
  code = ""

  constructor(private readonly listeners: Listeners) {
    this.register()
  }

  private register(): void {
    this.code = newCode()
    const peer = new Peer(`${PREFIX}${this.code}`)
    this.peer = peer
    peer.on("open", () => this.listeners.ready(this.code))
    peer.on("connection", (connection) => {
      if (!connection.peer.startsWith(PREFIX) || !validBattleCode(battleCodeOf(connection))) connection.close()
      else this.listeners.incoming(connection)
    })
    peer.on("disconnected", () => {
      this.listeners.disconnected()
      window.setTimeout(() => {
        if (!this.stopped && this.peer === peer && peer.disconnected) peer.reconnect()
      }, 2500)
    })
    peer.on("error", (error) => {
      if (error.type === "unavailable-id" && !this.stopped && ++this.attempts < 10) {
        peer.destroy()
        this.register()
      } else this.listeners.error(error.message)
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

  stop(): void {
    this.stopped = true
    this.peer?.destroy()
  }
}
