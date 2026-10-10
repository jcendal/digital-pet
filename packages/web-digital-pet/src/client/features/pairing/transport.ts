import Peer, { type DataConnection } from "peerjs"
import { IntlModule } from "../../../shared/i18n.ts"
import { PeerRetry } from "../../platform/peer-retry.ts"

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
  private peer: Peer | undefined
  private stopped = false
  private readonly retry = new PeerRetry(() => this.resume())

  constructor(
    private readonly code: string,
    private readonly listeners: TransferListeners,
  ) {
    this.register()
  }

  private register(): void {
    const peer = new Peer(`${PEER_PREFIX}${this.code}`)
    this.peer = peer
    peer.on("open", () => {
      if (!this.stopped && this.peer === peer) {
        this.retry.reset()
        this.listeners.ready()
      }
    })
    peer.on("connection", (connection) => {
      if (this.stopped || this.peer !== peer) connection.close()
      else this.listeners.incoming(connection)
    })
    peer.on("disconnected", () => {
      if (this.stopped || this.peer !== peer) return
      this.listeners.disconnected()
      this.retry.schedule()
    })
    peer.on("error", (error) => {
      if (!this.stopped && this.peer === peer) {
        this.listeners.error(error.message)
        if (["network", "server-error", "socket-error", "socket-closed"].includes(error.type)) this.retry.schedule()
      }
    })
  }

  connect(code: string): DataConnection {
    if (!this.peer?.open) throw new Error(IntlModule.translate("transport.thePairingServiceIsNotConnectedYet"))
    return this.peer.connect(`${PEER_PREFIX}${code}`, { serialization: "json", reliable: true })
  }

  get connected(): boolean {
    return this.peer?.open ?? false
  }

  resume(): void {
    this.retry.stop()
    this.stopped = false
    if (!this.peer || this.peer.destroyed) this.register()
    else if (this.peer.disconnected) this.peer.reconnect()
  }

  stop(): void {
    this.stopped = true
    this.retry.stop()
    this.peer?.destroy()
  }
}
