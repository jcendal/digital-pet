import type { HttpEvent } from "../http.ts"
import { delivery, services } from "../runtime/social.ts"
import { socialHandler } from "../social-http.ts"
import { socialSocket } from "../social-socket.ts"

type SocketEvent = { body?: string; requestContext: { connectionId: string; requestId?: string } }
const http = socialHandler(services)
export const handler = async (event: HttpEvent | SocketEvent) => {
  if ("connectionId" in event.requestContext) {
    await socialSocket(
      services,
      delivery,
      event.requestContext.connectionId,
      event.body ?? "{}",
      event.requestContext.requestId,
    )
    return { statusCode: 200 }
  }
  return http(event as HttpEvent)
}
