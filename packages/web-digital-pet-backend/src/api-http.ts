import { identifier, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { type HttpEvent, header, privateHandler, readBody, requireMutation } from "./http.ts"
export const authorizedAccount = (event: HttpEvent) => {
  const context = event.requestContext.authorizer?.lambda
  if (!context || typeof context.accountId !== "string" || typeof context.csrf !== "string")
    throw new OnlineError("unauthorized", 401)
  return { accountId: identifier(context.accountId), csrf: context.csrf }
}

export const authorizedHandler = <T>(
  origin: string,
  run: (input: {
    actor: string
    method: string
    path: string
    body: Record<string, unknown>
    event: HttpEvent
  }) => Promise<T>,
) =>
  privateHandler(async (event) => {
    const session = authorizedAccount(event)
    if (header(event, "x-account-id") !== session.accountId) throw new OnlineError("account-changed", 409)
    const method = event.requestContext.http.method
    if (method !== "GET") requireMutation(event, origin, session.csrf)
    return run({
      actor: session.accountId,
      method,
      path: event.rawPath.replace(/^\/api\/v1/, ""),
      body: method === "GET" ? {} : readBody(event),
      event,
    })
  })
