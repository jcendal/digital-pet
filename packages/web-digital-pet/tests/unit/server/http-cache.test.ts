import { expect, test } from "bun:test"
import type { IncomingMessage, ServerResponse } from "node:http"
import { gzipSync } from "node:zlib"

import { sendCachedAsset } from "../../../src/server/http/cache.ts"

const respond = (body: Buffer, tag?: string, gzip = false) => {
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
  const request = { headers: { "if-none-match": tag } } as IncomingMessage
  sendCachedAsset(request, response, "text/javascript", body, gzip ? "gzip" : undefined, true)
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
