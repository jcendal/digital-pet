import { OnlineError, type SessionView } from "@jcendal/digital-pet-online/contracts.ts"
import type { Session } from "./auth.ts"
import { digest } from "./identity.ts"
import type { ObjectStore } from "./store.ts"
export const sessionView = (session: Session): SessionView => ({
  accountId: session.accountId,
  csrf: session.csrf,
  accessExpiresAt: session.accessExpiresAt,
  expiresAt: session.expiresAt,
})
export const readSession = async (
  store: ObjectStore,
  handle: string,
  requireAccess = true,
  now = Date.now,
): Promise<SessionView> => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(handle)) throw new OnlineError("unauthorized", 401)
  const found = await store.get<Session>(`sessions/${digest(handle)}`)
  if (!found || found.value.revoked || found.value.expiresAt <= now()) throw new OnlineError("unauthorized", 401)
  if (requireAccess && found.value.accessExpiresAt <= now()) throw new OnlineError("refresh-required", 401)
  return sessionView(found.value)
}

export const SESSION_COOKIE = "__Host-digital-pet-session"
export const LOGIN_COOKIE = "__Host-digital-pet-login"
