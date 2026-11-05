import { boundedText, OnlineError } from "@jcendal/digital-pet-online/contracts.ts"
import { authorizedHandler } from "./api-http.ts"
import type { BackupService } from "./backups.ts"
import { response } from "./http.ts"
import { numberOf, operationId } from "./input.ts"
export const savesHandler = (services: { origin: string; backups: BackupService }) =>
  authorizedHandler(services.origin, async ({ actor, method, path, body }) => {
    if (path === "/me/backups" && method === "GET")
      return response(200, {
        backups: await services.backups.list(actor),
        pending: await services.backups.pending(actor),
      })
    if (path === "/me/backups/uploads" && method === "POST")
      return response(
        200,
        await services.backups.create(
          actor,
          operationId(body.id),
          numberOf(body.bytes),
          boundedText(body.checksum, 64),
          boundedText(body.label, 80),
        ),
      )
    const match = /^\/me\/backups\/([A-Za-z0-9_-]+)(?:\/(complete|download))?$/.exec(path)
    if (match?.[1]) {
      if (match[2] === "complete" && method === "POST")
        return response(200, await services.backups.complete(actor, match[1]))
      if (match[2] === "download" && method === "GET")
        return response(200, { url: await services.backups.download(actor, match[1]) })
      if (!match[2] && method === "DELETE") {
        await services.backups.remove(actor, match[1])
        return response(200, { ok: true })
      }
    }
    throw new OnlineError("not-found", 404)
  })
