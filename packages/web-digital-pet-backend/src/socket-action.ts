import { boundedText, identifier, OnlineError, record } from "@jcendal/digital-pet-online/contracts.ts"
import { reportFailure } from "./diagnostics.ts"
import type { RealtimeService, SocketDelivery } from "./realtime.ts"
export const socketAction = async (
  service: RealtimeService,
  delivery: SocketDelivery,
  connectionId: string,
  input: string,
  gatewayRequestId?: string,
): Promise<void> => {
  let requestId: string | undefined
  let channel: string | undefined
  let action: string | undefined
  try {
    if (Buffer.byteLength(input) > 25 * 1024) throw new OnlineError("frame-too-large", 413)
    let body: Record<string, unknown>
    try {
      body = record(JSON.parse(input))
    } catch {
      throw new OnlineError("invalid-json")
    }
    if (typeof body.requestId === "string" && /^[a-zA-Z0-9_:-]{1,100}$/.test(body.requestId)) requestId = body.requestId
    if (["register", "open", "resume", "relay"].includes(String(body.action))) action = String(body.action)
    if (body.action === "register") {
      const namespace = boundedText(body.namespace, 16)
      const code = await service.register(connectionId, namespace)
      if (namespace === "battle") await service.subscribe(connectionId)
      await delivery.send(connectionId, { kind: "registered", requestId: body.requestId, namespace, code })
    } else if (body.action === "open") {
      const requestId = identifier(body.requestId)
      const channel = await service.open(
        connectionId,
        boundedText(body.namespace, 16),
        boundedText(body.code, 16),
        requestId,
      )
      await delivery.send(connectionId, { kind: "opened", requestId, channel })
    } else if (body.action === "resume") {
      channel = identifier(body.channel)
      await service.resume(connectionId, channel)
      await delivery.send(connectionId, { kind: "resumed", channel })
    } else if (body.action === "relay") {
      channel = identifier(record(body.frame).channel)
      await service.relay(connectionId, body.frame)
    } else throw new OnlineError("invalid-action")
  } catch (error) {
    reportFailure("socket-action", error, { requestId: gatewayRequestId, connectionId, commandId: requestId })
    await delivery.send(connectionId, {
      kind: "error",
      error: error instanceof OnlineError ? error.code : "temporarily-unavailable",
      requestId,
      action,
      channel,
      retryable:
        !(error instanceof OnlineError) ||
        error.status >= 500 ||
        error.status === 429 ||
        error.code === "concurrent-update" ||
        error.code === "peer-offline",
    })
  }
}
