import { createHash } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

/** Stable URLs revalidate so rebuilding the local app never leaves stale assets. */
export const sendCachedAsset = (
  request: IncomingMessage,
  response: ServerResponse,
  contentType: string,
  body: Buffer,
  encoding?: "gzip",
  variesByEncoding = false,
  immutable = false,
): void => {
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`
  const candidates = request.headers["if-none-match"]?.split(",").map((value) => value.trim().replace(/^W\//, ""))
  const unchanged = candidates?.some((value) => value === "*" || value === etag) ?? false
  response.writeHead(unchanged ? 304 : 200, {
    "Content-Type": contentType,
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
    ...(variesByEncoding ? { Vary: "Accept-Encoding" } : {}),
    ...(encoding ? { "Content-Encoding": encoding } : {}),
  })
  response.end(unchanged ? undefined : body)
}
