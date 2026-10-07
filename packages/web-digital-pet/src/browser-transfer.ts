import Peer, { type DataConnection } from "peerjs"

const PEER_PREFIX = "web-digital-pet-"
export const CODE_LENGTH = 16

export const normalizeDeviceCode = (value: string): string => value.toUpperCase().replace(/[\s-]/g, "")
export const validDeviceCode = (value: string): boolean => /^[A-HJ-NP-Z2-9]{16}$/.test(value)
export const displayDeviceCode = (value: string): string => value.match(/.{1,4}/g)?.join("-") ?? value

export type TransferListeners = {
  ready: () => void
  incoming: (connection: DataConnection) => void
  disconnected: () => void
  error: (message: string) => void
}

export class BrowserTransfer {
  private readonly peer: Peer
  private stopped = false

  constructor(code: string, listeners: TransferListeners) {
    this.peer = new Peer(`${PEER_PREFIX}${code}`)
    this.peer.on("open", listeners.ready)
    this.peer.on("connection", listeners.incoming)
    this.peer.on("disconnected", () => {
      listeners.disconnected()
      window.setTimeout(() => {
        if (!this.stopped && this.peer.disconnected) this.peer.reconnect()
      }, 2500)
    })
    this.peer.on("error", (error) => listeners.error(error.message))
  }

  connect(code: string): DataConnection {
    if (!this.peer.open) throw new Error("The pairing service is not connected yet")
    return this.peer.connect(`${PEER_PREFIX}${code}`, { serialization: "json", reliable: true })
  }

  stop(): void {
    this.stopped = true
    this.peer.destroy()
  }
}
