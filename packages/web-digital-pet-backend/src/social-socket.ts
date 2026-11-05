import { identifier, OnlineError, record } from "@jcendal/digital-pet-online/contracts.ts"
import { parseSocialCommand } from "@jcendal/digital-pet-online/social-commands.ts"
import { reportFailure } from "./diagnostics.ts"
import type { SocketDelivery } from "./realtime.ts"
import { executeSocial, type SocialServices } from "./social-application.ts"

/** Socket authorization derives the actor from its session, never from message input. */
export const socialSocket = async (
  services: SocialServices,
  delivery: SocketDelivery,
  connectionId: string,
  input: string,
  gatewayRequestId?: string,
): Promise<void> => {
  let requestId: string | undefined
  let status = 200
  let body: unknown
  try {
    if (Buffer.byteLength(input) > 24 * 1024) throw new OnlineError("frame-too-large", 413)
    const message = record(JSON.parse(input))
    requestId = identifier(message.requestId)
    const actor = await services.realtime.identity(connectionId)
    if (message.accountId !== actor) throw new OnlineError("account-changed", 409)
    const command = parseSocialCommand(message.command)
    const type = command.type
    // Large paginated reads use HTTP; commands and live notifications use this socket.
    if (type === "inbox.read") throw new OnlineError("http-required", 413)
    body = await executeSocial(services, actor, command)
    if (Buffer.byteLength(JSON.stringify(body)) > 23 * 1024) {
      if (!type.startsWith("trade.")) throw new OnlineError("http-required", 413)
      // The mutation has committed. Return an authorized read resource, never ask to replay it.
      const relationship = identifier(record(command.input).relationship)
      const operation = identifier(record(body).id)
      status = 303
      body = { location: `/api/v1/relationships/${relationship}/trades/${operation}` }
    }
  } catch (error) {
    if (!(error instanceof SyntaxError))
      reportFailure("social-command", error, { requestId: gatewayRequestId, connectionId, commandId: requestId })
    status = error instanceof OnlineError ? error.status : error instanceof SyntaxError ? 400 : 500
    body = {
      error:
        error instanceof OnlineError
          ? error.code
          : error instanceof SyntaxError
            ? "invalid-json"
            : "temporarily-unavailable",
    }
  }
  try {
    await delivery.send(connectionId, { kind: "response", requestId, status, body })
  } catch (error) {
    reportFailure("socket-response", error, { requestId: gatewayRequestId, connectionId, commandId: requestId })
    throw error
  }
}
