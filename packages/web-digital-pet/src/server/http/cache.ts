import { createHash } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

const byteRange = (header: string, size: number): { start: number; end: number } | null | undefined => {
  // Unsupported units and multiple ranges may be answered with the complete representation.
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match) return undefined
  const first = match[1] ? Number(match[1]) : undefined
  const last = match[2] ? Number(match[2]) : undefined
  if (size === 0 || (first === undefined && last === undefined)) return null
  if (first !== undefined && !Number.isSafeInteger(first)) return null
  if (last !== undefined && !Number.isSafeInteger(last)) return null
  if (first === undefined && last === 0) return null
  const start = first ?? Math.max(0, size - (last ?? 0))
  const end = first === undefined ? size - 1 : Math.min(last ?? size - 1, size - 1)
  return start >= size || end < start ? null : { start, end }
}

/** Stable URLs revalidate so rebuilding the local app never leaves stale assets. */
export const sendCachedAsset = (
  request: IncomingMessage,
  response: ServerResponse,
  contentType: string,
  body: Buffer,
  encoding?: "gzip",
  variesByEncoding = false,
  options: { immutable?: boolean; byteRanges?: boolean } = {},
): void => {
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`
  const candidates = request.headers["if-none-match"]?.split(",").map((value) => value.trim().replace(/^W\//, ""))
  const unchanged = candidates?.some((value) => value === "*" || value === etag) ?? false
  const range =
    options.byteRanges &&
    !unchanged &&
    request.headers.range &&
    (!request.headers["if-range"] || request.headers["if-range"] === etag)
      ? byteRange(request.headers.range, body.length)
      : undefined
  const sent = range ? body.subarray(range.start, range.end + 1) : range === null ? Buffer.alloc(0) : body
  response.writeHead(unchanged ? 304 : range === null ? 416 : range ? 206 : 200, {
    "Content-Type": contentType,
    "Cache-Control": options.immutable ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
    ...(variesByEncoding ? { Vary: "Accept-Encoding" } : {}),
    ...(encoding ? { "Content-Encoding": encoding } : {}),
    ...(options.byteRanges ? { "Accept-Ranges": "bytes" } : {}),
    ...(!unchanged ? { "Content-Length": String(sent.length) } : {}),
    ...(range
      ? { "Content-Range": `bytes ${range.start}-${range.end}/${body.length}` }
      : range === null
        ? { "Content-Range": `bytes */${body.length}` }
        : {}),
  })
  response.end(unchanged || request.method === "HEAD" ? undefined : sent)
}
