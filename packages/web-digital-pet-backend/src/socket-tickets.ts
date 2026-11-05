import { randomBytes } from "node:crypto"
import { identifier, OnlineError, type SessionView } from "@jcendal/digital-pet-online/contracts.ts"
import { digest } from "./identity.ts"
import { change, type ObjectStore } from "./store.ts"
export type Ticket = { sessionKey: string; installationId: string; expiresAt: number; used: boolean }
export class SocketTickets {
  constructor(
    private readonly authStore: ObjectStore,
    private readonly now: () => number = Date.now,
  ) {}
  async ticket(handle: string, installationId: string, session: SessionView) {
    identifier(installationId)
    const hour = Math.floor(this.now() / 3_600_000)
    await change<{ hour: number; count: number }, void>(
      this.authStore,
      `tickets/quotas/${session.accountId}`,
      () => ({ hour, count: 0 }),
      (value) => {
        if (value.hour !== hour) {
          value.hour = hour
          value.count = 0
        }
        if (value.count >= 120) throw new OnlineError("connection-limit", 429)
        value.count++
      },
    )
    const ticket = randomBytes(32).toString("base64url")
    const value: Ticket = {
      sessionKey: digest(handle),
      installationId,
      expiresAt: Math.min(this.now() + 60_000, session.accessExpiresAt),
      used: false,
    }
    if (!(await this.authStore.put(`tickets/${digest(ticket)}`, value, null)))
      throw new OnlineError("ticket-retry", 409)
    return { ticket, expiresAt: value.expiresAt }
  }
}
