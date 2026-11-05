import { reportFailure } from "../diagnostics.ts"
import { cookie, type HttpEvent } from "../http.ts"
import { authorize } from "../runtime/authorizer.ts"
import { SESSION_COOKIE } from "../sessions.ts"

export const handler = async (event: HttpEvent) => {
  try {
    const session = await authorize(cookie(event, SESSION_COOKIE))
    return { isAuthorized: true, context: { accountId: session.accountId, csrf: session.csrf } }
  } catch (error) {
    reportFailure("authorization", error, { requestId: event.requestContext.requestId })
    return { isAuthorized: false }
  }
}
