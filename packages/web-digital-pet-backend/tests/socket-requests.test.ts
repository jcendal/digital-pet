import { expect, test } from "bun:test"
import { socketParts } from "@jcendal/digital-pet-online/socket-rpc.ts"
import { SocketRequests } from "../src/socket-requests.ts"
import { MemoryStore } from "./memory-store.ts"

test("different Lambda instances assemble a request once using CAS, including concurrent duplicate fragments", async () => {
  const store = new MemoryStore()
  const a = new SocketRequests(store),
    b = new SocketRequests(store)
  const command = { type: "trade.prepare", input: { payload: "á".repeat(15_000) } }
  const parts = socketParts(command, 48 * 1024)
  const results: unknown[] = []
  for (const part of [...parts].reverse())
    results.push(
      ...(await Promise.all([a.accept("connection", "request", part), b.accept("connection", "request", part)])),
    )
  expect(results.filter((result) => result !== undefined)).toEqual([command])
  for (const part of parts) expect(await a.accept("connection", "request", part)).toBeUndefined()
  // A different connection cannot complete someone else's pending request.
  expect(await a.accept("another", "request", parts.at(-1))).toBeUndefined()
})

test("incomplete requests expire and inconsistent or oversized input cannot execute", async () => {
  let now = 0
  const requests = new SocketRequests(new MemoryStore(), () => now)
  await requests.accept("a", "b", { index: 0, total: 2, data: "hello" })
  await expect(requests.accept("a", "b", { index: 0, total: 2, data: "other" })).rejects.toThrow("invalid-fragment")
  now = 60_000
  await expect(requests.accept("a", "b", { index: 1, total: 2, data: "end" })).rejects.toThrow("request-expired")
  for (let index = 0; index < 2; index++)
    await requests.accept("a", "large", { index, total: 3, data: "x".repeat(20_000) })
  await expect(requests.accept("a", "large", { index: 2, total: 3, data: "x".repeat(20_000) })).rejects.toThrow(
    "message-too-large",
  )
})
