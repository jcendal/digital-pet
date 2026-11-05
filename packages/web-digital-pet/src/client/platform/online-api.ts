import { record, type SessionView } from "@jcendal/digital-pet-online/contracts.ts"
import { socialCommandFor } from "@jcendal/digital-pet-online/social-commands.ts"
import { type OnlineContext, readOnlineContext } from "../persistence/online-store.ts"
import { sendSocialCommand } from "./online-rpc.ts"

export const onlineConfigured = (): boolean =>
  document.documentElement.dataset.saveHost === "browser" && Boolean(document.documentElement.dataset.onlineSocket)
export const onlineSocketUrl = (): string => document.documentElement.dataset.onlineSocket ?? ""
export const backupOrigin = (): string => document.documentElement.dataset.backupOrigin ?? ""
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code)
  }
}
let session: SessionView | null = null
let sessionLoaded = false
let refreshing: Promise<SessionView | null> | undefined
const changed = () => window.dispatchEvent(new Event("digital-pet:account-changed"))
export const currentOnlineSession = (): SessionView | null => session
const decode = async (response: Response): Promise<Record<string, unknown>> => {
  const value = record(await response.json())
  if (!response.ok) throw new ApiError(typeof value.error === "string" ? value.error : "unavailable", response.status)
  return value
}
export const loadOnlineSession = async (): Promise<SessionView | null> => {
  if (!onlineConfigured()) return null
  const before = session?.accountId
  try {
    const value = await decode(
      await fetch("/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }),
    )
    if (
      typeof value.accountId !== "string" ||
      typeof value.csrf !== "string" ||
      typeof value.accessExpiresAt !== "number" ||
      typeof value.expiresAt !== "number"
    )
      throw new Error("online.invalid")
    session = value as SessionView
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    session = null
  }
  if (before !== session?.accountId) changed()
  sessionLoaded = true
  return session
}
export const ensureOnlineSession = async (): Promise<SessionView> => {
  if (sessionLoaded && !session) throw new Error("online.signIn")
  if (refreshing) {
    const result = await refreshing
    if (!result) throw new Error("online.signIn")
    return result
  }
  if (session && session.accessExpiresAt > Date.now() + 60_000) return session
  refreshing = (async () => {
    let value = await loadOnlineSession()
    if (!value) return null
    for (let attempt = 0; value.accessExpiresAt <= Date.now() + 60_000 && attempt < 4; attempt++) {
      try {
        const fresh = await decode(
          await fetch("/auth/refresh", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "X-CSRF-Token": value.csrf },
            signal: AbortSignal.timeout(15_000),
          }),
        )
        if (fresh.accountId !== value.accountId) throw new Error("online.saveChanged")
        session = fresh as SessionView
        value = session
        window.dispatchEvent(new Event("digital-pet:session-renewed"))
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "refresh-in-progress") throw error
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
        value = await loadOnlineSession()
        if (!value) return null
      }
    }
    if (value.accessExpiresAt <= Date.now()) throw new Error("online.signIn")
    return value
  })().finally(() => {
    refreshing = undefined
  })
  const value = await refreshing
  if (!value) throw new Error("online.signIn")
  return value
}
export const onlineContext = async (): Promise<OnlineContext & { accountId: string }> => {
  const active = await ensureOnlineSession()
  const context = await readOnlineContext()
  if (context.accountId !== active.accountId) throw new Error("online.adoptFirst")
  return { ...context, accountId: active.accountId }
}
export const api = async <T>(path: string, method = "GET", body?: unknown, expectedAccount?: string): Promise<T> => {
  const active = await ensureOnlineSession()
  if (expectedAccount && active.accountId !== expectedAccount) throw new Error("online.saveChanged")
  const command = method === "GET" ? undefined : socialCommandFor(method, path, body === undefined ? {} : record(body))
  const rpc = command ? sendSocialCommand(active.accountId, command) : undefined
  const response = await (rpc ??
    fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: { "Content-Type": "application/json", "X-CSRF-Token": active.csrf, "X-Account-Id": active.accountId },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }))
  if (rpc && response.status === 303) {
    const value = record(await response.json())
    if (
      typeof value.location !== "string" ||
      !/^\/api\/v1\/relationships\/[a-f0-9]{64}\/trades\/[A-Za-z0-9_-]+$/.test(value.location)
    )
      throw new Error("online.invalid")
    return api<T>(value.location, "GET", undefined, active.accountId)
  }
  let value: Record<string, unknown>
  try {
    value = await decode(response)
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.code === "account-changed")
    ) {
      // Another tab may have changed the cookie. Refresh metadata, never replay a mutation.
      await loadOnlineSession().catch(() => {})
    }
    throw error
  }
  if (session?.accountId !== active.accountId) throw new Error("online.saveChanged")
  return value as T
}
export const logoutOnline = async (): Promise<void> => {
  await api("/auth/logout", "POST")
  session = null
  changed()
}
export const newOperationId = (): string => `${Date.now()}-${crypto.randomUUID()}`
