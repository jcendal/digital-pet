import type { OnlineConnection } from "../../platform/online-connection.ts"
import { OnlineEndpoint } from "../../platform/online-socket.ts"

const PREFIX = "web-digital-pet-battle-v1-"
export const validBattleCode = (value: string): boolean => /^\d{6}$/.test(value)
export const battleCodeOf = (connection: OnlineConnection): string => connection.peer.slice(PREFIX.length)
export class BattleTransport extends OnlineEndpoint {
  constructor(listeners: {
    ready: (code: string) => void
    incoming: (connection: OnlineConnection) => void
    disconnected: () => void
    error: (message: string) => void
  }) {
    super("battle", PREFIX, listeners)
  }
}
