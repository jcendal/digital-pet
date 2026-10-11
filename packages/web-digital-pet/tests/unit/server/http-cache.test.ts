import { expect, test } from "bun:test"
import type { IncomingMessage, ServerResponse } from "node:http"
import { gzipSync } from "node:zlib"

import { sendCachedAsset } from "../../../src/server/http/cache.ts"

const respond = (
  body: Buffer,
  tag?: string,
  gzip = false,
  media?: { range?: string; ifRange?: string; method?: string },
) => {
  let status = 0
  let headers: Record<string, string> = {}
  let sent: Buffer | undefined
  const response = {
    writeHead: (code: number, values: Record<string, string>) => {
      status = code
      headers = values
    },
    end: (value: Buffer | undefined) => {
      sent = value
    },
  } as unknown as ServerResponse
  const request = {
    method: media?.method,
    headers: { "if-none-match": tag, range: media?.range, "if-range": media?.ifRange },
  } as IncomingMessage
  sendCachedAsset(request, response, media ? "audio/mpeg" : "text/javascript", body, gzip ? "gzip" : undefined, true, {
    byteRanges: Boolean(media),
  })
  return { status, headers, sent }
}

test("unchanged assets revalidate without sending their body; changed bytes get a new response", () => {
  const body = Buffer.from("first build")
  const first = respond(body)
  expect(first.status).toBe(200)
  expect(first.headers["Cache-Control"]).toBe("public, max-age=0, must-revalidate")
  expect(first.headers.Vary).toBe("Accept-Encoding")
  for (const condition of [first.headers.ETag, `W/${first.headers.ETag}`, `"other", ${first.headers.ETag}`, "*"]) {
    const cached = respond(body, condition)
    expect(cached.status).toBe(304)
    expect(cached.sent).toBeUndefined()
    expect(cached.headers.ETag).toBe(first.headers.ETag)
  }
  const changed = respond(Buffer.from("second build"), first.headers.ETag)
  expect(changed.status).toBe(200)
  expect(changed.headers.ETag).not.toBe(first.headers.ETag)
})

test("compressed and uncompressed representations have distinct validators and declare Vary", () => {
  const body = Buffer.from("a repeated script ".repeat(100))
  const plain = respond(body)
  const gzip = respond(gzipSync(body), plain.headers.ETag, true)
  expect(gzip.status).toBe(200)
  expect(gzip.headers.ETag).not.toBe(plain.headers.ETag)
  expect(gzip.headers["Content-Encoding"]).toBe("gzip")
  expect(gzip.headers.Vary).toBe("Accept-Encoding")
})

test("media serves bounded, open-ended and suffix ranges with correct lengths for Safari", () => {
  const body = Buffer.from("0123456789")
  for (const [header, bytes, contentRange] of [
    ["bytes=0-1", "01", "bytes 0-1/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-100", "89", "bytes 8-9/10"],
    ["bytes=-100", "0123456789", "bytes 0-9/10"],
  ]) {
    const response = respond(body, undefined, false, { range: header })
    expect(response.status).toBe(206)
    expect(response.sent?.toString()).toBe(bytes)
    expect(response.headers["Content-Range"]).toBe(contentRange)
    expect(response.headers["Content-Length"]).toBe(String(bytes!.length))
    expect(response.headers["Accept-Ranges"]).toBe("bytes")
  }
  for (const range of ["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=9007199254740992-"]) {
    const response = respond(body, undefined, false, { range })
    expect(response.status).toBe(416)
    expect(response.headers["Content-Range"]).toBe("bytes */10")
    expect(response.sent).toHaveLength(0)
  }
})

test("range requests respect validators and HEAD keeps metadata without sending audio", () => {
  const body = Buffer.from("0123456789")
  const first = respond(body, undefined, false, {})
  expect(respond(body, undefined, false, { range: "bytes=0-1", ifRange: '"old"' }).status).toBe(200)
  expect(respond(body, undefined, false, { range: "bytes=0-1", ifRange: first.headers.ETag }).status).toBe(206)
  const unchanged = respond(body, first.headers.ETag, false, { range: "bytes=0-1" })
  expect(unchanged.status).toBe(304)
  expect(unchanged.sent).toBeUndefined()
  const head = respond(body, undefined, false, { method: "HEAD" })
  expect(head.headers["Content-Length"]).toBe("10")
  expect(head.sent).toBeUndefined()
})
