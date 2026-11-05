import type { OnlineConnection } from "../../platform/online-connection.ts"
import { OnlineEndpoint } from "../../platform/online-socket.ts"
export const CODE_LENGTH = 16
export const normalizeDeviceCode = (value: string): string => value.toUpperCase().replace(/[\s-]/g, "")
export const validDeviceCode = (value: string): boolean => /^[A-HJ-NP-Z2-9]{16}$/.test(value)
export const displayDeviceCode = (value: string): string => value.match(/.{1,4}/g)?.join("-") ?? value
export type TransferListeners = {
  ready: (code: string) => void
  incoming: (connection: OnlineConnection) => void
  disconnected: () => void
  error: (message: string) => void
}
export class BrowserTransfer extends OnlineEndpoint {
  constructor(listeners: TransferListeners) {
    super("transfer", "web-digital-pet-", listeners)
  }
}
