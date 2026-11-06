import { expect, test } from "bun:test"
import { jsonBytes, MAX_FRAME_BYTES } from "../src/contracts.ts"
import { MAX_SOCKET_REQUEST_BYTES, SocketAssembly, socketParts } from "../src/socket-rpc.ts"

test("escaped Unicode payloads fit Gateway frames and assemble out of order without duplicate data", () => {
  const value = { text: '\\"🙂á\n'.repeat(12_000) }
  const parts = socketParts(value, 1024 * 1024)
  const assembly = new SocketAssembly()
  let source: string | undefined
  for (const fragment of [...parts].reverse()) {
    expect(
      jsonBytes({ kind: "response-part", requestId: crypto.randomUUID(), status: 200, fragment }),
    ).toBeLessThanOrEqual(MAX_FRAME_BYTES)
    assembly.add(fragment)
    source = assembly.add(fragment)
  }
  expect(JSON.parse(source!)).toEqual(value)
})

test("fragments enforce size, index, count and duplicate consistency", () => {
  expect(() => socketParts("a".repeat(MAX_SOCKET_REQUEST_BYTES), MAX_SOCKET_REQUEST_BYTES)).toThrow("message-too-large")
  const assembly = new SocketAssembly(10)
  expect(() => assembly.add({ index: -1, total: 2, data: "a" })).toThrow("invalid-fragment")
  assembly.add({ index: 0, total: 2, data: "a" })
  expect(() => assembly.add({ index: 0, total: 2, data: "b" })).toThrow("invalid-fragment")
  expect(() => assembly.add({ index: 1, total: 3, data: "b" })).toThrow("invalid-fragment")
  expect(() => assembly.add({ index: 1, total: 2, data: "b".repeat(10) })).toThrow("message-too-large")
})
