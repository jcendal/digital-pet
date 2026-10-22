import Peer, { type DataConnection } from "peerjs"
import { validCode } from "../../../domain/social/model.ts"
import { PeerRetry } from "../../platform/peer-retry.ts"

const PREFIX = "web-digital-pet-social-v1-"
export const socialPeerCode = (peer: string): string | undefined => {
  const code = peer.startsWith(PREFIX) ? peer.slice(PREFIX.length) : ""
  return validCode(code) ? code : undefined
}
export class SocialTransport {
  private peer: Peer | undefined
  private stopped = false
  private retry = new PeerRetry(() => this.resume())
  constructor(
    private code: string,
    private listeners: {
      ready: () => void
      incoming: (c: DataConnection) => void
      offline: () => void
      conflict: () => void
    },
  ) {}
  start(): void {
    if (this.peer && !this.peer.destroyed) return
    this.stopped = false
    const peer = new Peer(PREFIX + this.code)
    this.peer = peer
    peer.on("open", () => {
      if (this.peer === peer && !this.stopped) {
        this.retry.reset()
        this.listeners.ready()
      }
    })
    peer.on("connection", (c) => {
      if (this.stopped || this.peer !== peer) c.close()
      else this.listeners.incoming(c)
    })
    peer.on("disconnected", () => {
      if (!this.stopped) {
        this.listeners.offline()
        this.retry.schedule()
      }
    })
    peer.on("error", (e) => {
      if (!this.stopped && e.type !== "peer-unavailable") {
        this.listeners.offline()
        if (e.type === "unavailable-id") this.listeners.conflict()
        else this.retry.schedule()
      }
    })
  }
  connect(code: string): DataConnection {
    if (!this.peer?.open || !validCode(code)) throw new Error("social.offline")
    return this.peer.connect(PREFIX + code, { serialization: "json", reliable: true })
  }
  resume(): void {
    this.stopped = false
    this.retry.stop()
    if (!this.peer || this.peer.destroyed) this.start()
    else if (this.peer.disconnected) this.peer.reconnect()
  }
  stop(): void {
    this.stopped = true
    this.retry.stop()
    this.peer?.destroy()
  }
}
