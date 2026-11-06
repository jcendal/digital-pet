import { identifier, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { type AuthService, LOGIN_COOKIE, SESSION_COOKIE } from "./auth.ts"
import { cookie, privateHandler, readBody, requireMutation, response } from "./http.ts"
import type { RealtimeService } from "./realtime.ts"

const setCookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
export const authHandler = (services: {
  origin: string
  auth: AuthService
  realtime: Pick<RealtimeService, "ticket">
}) =>
  privateHandler(async (event) => {
    const method = event.requestContext.http.method
    const path = event.rawPath
    const handle = cookie(event, SESSION_COOKIE)
    if (path === "/auth/login" && method === "GET") {
      const provider = event.queryStringParameters?.provider ?? "Google"
      if (provider !== "Google") throw new OnlineError("invalid-provider")
      const result = await services.auth.login(provider)
      return {
        ...response(302, {}, [setCookie(LOGIN_COOKIE, result.proof, 600)]),
        headers: { ...response(302, {}).headers, Location: result.url },
      }
    }
    if (path === "/auth/callback" && method === "GET") {
      const result = await services.auth.callback(
        event.queryStringParameters?.state ?? "",
        event.queryStringParameters?.code ?? "",
        cookie(event, LOGIN_COOKIE),
      )
      // Existing sockets authenticate by session handle, independently of cookies.
      // Retire the replaced session only after the new OAuth proof was validated.
      if (handle && handle !== result.handle) await services.auth.logout(handle)
      return {
        ...response(302, {}, [
          setCookie(SESSION_COOKIE, result.handle, Math.floor((result.session.expiresAt - Date.now()) / 1000)),
          setCookie(LOGIN_COOKIE, "", 0),
        ]),
        headers: {
          ...response(302, {}).headers,
          Location: `${services.origin}/#profile`,
          "Referrer-Policy": "no-referrer",
        },
      }
    }
    if (path === "/auth/session" && method === "GET") return response(200, await services.auth.session(handle, false))
    const session = await services.auth.session(handle, false)
    requireMutation(event, services.origin, session.csrf)
    if (path === "/auth/ticket" && method === "POST") {
      const access = await services.auth.session(handle)
      return response(200, await services.realtime.ticket(handle, identifier(readBody(event).installationId), access))
    }
    if (path === "/auth/refresh" && method === "POST") return response(200, await services.auth.refresh(handle))
    if (path === "/auth/logout" && method === "POST") {
      await services.auth.logout(handle)
      return response(200, { ok: true }, [setCookie(SESSION_COOKIE, "", 0)])
    }
    throw new OnlineError("not-found", 404)
  })
