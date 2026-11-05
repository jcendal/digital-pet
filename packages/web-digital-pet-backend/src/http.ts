import { MAX_HTTP_BODY_BYTES, OnlineError, record } from "@jcendal/digital-pet-online/contracts.ts"
import { reportFailure } from "./diagnostics.ts"

export { numberOf, operationId } from "./input.ts"

export type HttpEvent = {
  rawPath: string
  body?: string
  isBase64Encoded?: boolean
  cookies?: string[]
  headers: Record<string, string | undefined>
  queryStringParameters?: Record<string, string | undefined>
  requestContext: { requestId?: string; http: { method: string }; authorizer?: { lambda?: Record<string, unknown> } }
}
export const header = (event: HttpEvent, name: string): string =>
  Object.entries(event.headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? ""
export const cookie = (event: HttpEvent, name: string): string => {
  const values = (event.cookies ?? [header(event, "cookie")])
    .flatMap((line) => line.split(";"))
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
  return values.length === 1 ? (values[0]?.slice(name.length + 1) ?? "") : ""
}
export const readBody = (event: HttpEvent): Record<string, unknown> => {
  const value = event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : (event.body ?? "{}")
  if (Buffer.byteLength(value) > MAX_HTTP_BODY_BYTES) throw new OnlineError("request-too-large", 413)
  try {
    return record(JSON.parse(value))
  } catch (error) {
    if (error instanceof OnlineError) throw error
    throw new OnlineError("invalid-json")
  }
}
export const response = (statusCode: number, body: unknown, cookies: string[] = []) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, private",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  },
  cookies,
  body: JSON.stringify(body),
})
export const requireMutation = (event: HttpEvent, origin: string, csrf: string): void => {
  if (header(event, "origin") !== origin || header(event, "x-csrf-token") !== csrf)
    throw new OnlineError("forbidden", 403)
}

export const privateHandler =
  <T>(run: (event: HttpEvent) => Promise<T>) =>
  async (event: HttpEvent) => {
    try {
      return await run(event)
    } catch (error) {
      reportFailure("http-request", error, { requestId: event.requestContext.requestId })
      if (error instanceof OnlineError) return response(error.status, { error: error.code })
      return response(500, { error: "temporarily-unavailable" })
    }
  }
