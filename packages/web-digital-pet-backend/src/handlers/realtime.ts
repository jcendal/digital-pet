import { OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { reportFailure } from "../diagnostics.ts"
import { Notifications } from "../notifications.ts"
import { dataBucket, dataStore, delivery, origin, realtime as service } from "../runtime/realtime.ts"
import { socketAction } from "../socket-action.ts"

type Event = {
  headers?: Record<string, string | undefined>
  body?: string
  queryStringParameters?: Record<string, string | undefined>
  requestContext: { connectionId: string; requestId?: string; routeKey: string; domainName: string; stage: string }
}
type StorageEvent = { Records: Array<{ s3: { bucket: { name: string }; object: { key: string; eTag: string } } }> }
export const handler = async (event: Event | StorageEvent) => {
  if ("Records" in event) {
    const notifications = new Notifications(dataStore, service)
    try {
      for (const record of event.Records) {
        if (record.s3.bucket.name !== dataBucket) throw new Error("Unexpected event bucket")
        await notifications.changed(decodeURIComponent(record.s3.object.key.replace(/\+/g, " ")), record.s3.object.eTag)
      }
    } catch (error) {
      reportFailure("notification-delivery", error)
      throw error
    }
    return
  }
  const { connectionId, routeKey } = event.requestContext
  try {
    if (routeKey === "$connect") {
      const suppliedOrigin = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === "origin")?.[1]
      if (suppliedOrigin !== origin) throw new OnlineError("forbidden", 403)
      await service.connect(connectionId, event.queryStringParameters?.ticket ?? "")
    } else if (routeKey === "$disconnect") await service.disconnect(connectionId)
    else {
      await socketAction(service, delivery, connectionId, event.body ?? "{}", event.requestContext.requestId)
    }
    return { statusCode: 200 }
  } catch (error) {
    reportFailure("socket-lifecycle", error, { requestId: event.requestContext.requestId, connectionId })
    const code = error instanceof OnlineError ? error.code : "temporarily-unavailable"
    if (routeKey !== "$connect" && routeKey !== "$disconnect") {
      try {
        await delivery.send(connectionId, { kind: "error", error: code })
      } catch {
        /* The socket may already be gone. */
      }
    }
    return { statusCode: error instanceof OnlineError ? error.status : 500 }
  }
}
