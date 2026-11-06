import { expect, test } from "bun:test"
import { SocketAssembly, socketParts } from "@jcendal/digital-pet-online/socket-rpc.ts"
import { OnlineRequests } from "../../../src/client/platform/online-requests.ts"

const setup = (timeout = 1000) => {
  const state = { connected: false, account: "alice", resumes: 0 }
  const sent: Array<Record<string, unknown>> = []
  const requests = new OnlineRequests(
    {
      connected: () => state.connected,
      account: () => state.account,
      resume: () => state.resumes++,
      send: (value) => {
        sent.push(value as Record<string, unknown>)
        return state.connected
      },
    },
    timeout,
  )
  const open = () => {
    state.connected = true
    requests.opened()
  }
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
  return { state, sent, requests, open, tick }
}

test("waits for a connection, correlates replies and never replays sent commands after disconnect", async () => {
  const { state, sent, requests, open, tick } = setup()
  const first = requests.request("alice", { type: "profile.read", input: {} })
  expect(sent).toHaveLength(0)
  open()
  await tick()
  requests.receive({ kind: "response", requestId: "unknown", status: 200, body: {} })
  requests.receive({ kind: "response", requestId: sent[0]!.requestId, status: 200, body: { alias: "Alice" } })
  expect(await (await first).json()).toEqual({ alias: "Alice" })
  const second = requests.request("alice", { type: "gift.send", input: {} }).then(
    () => "unexpected success",
    (error: Error) => error.message,
  )
  await tick()
  expect(requests.size).toBe(1)
  expect(sent).toHaveLength(2)
  state.connected = false
  requests.disconnected()
  // Observe cancellation before the request deadline; a timeout is not proof of disconnect handling.
  await tick()
  expect(requests.size).toBe(0)
  expect(await second).toBe("online.offline")
  open()
  await tick()
  expect(sent).toHaveLength(2)
  expect(requests.size).toBe(0)
})

test("bounds concurrency, rejects all queued work on disconnect and times out waiting for a connection", async () => {
  const { requests, open, sent, tick } = setup(30)
  const tasks = Array.from({ length: 32 }, () => requests.request("alice", { type: "profile.read", input: {} }))
  const settled = Promise.allSettled(tasks)
  await expect(requests.request("alice", { type: "profile.read", input: {} })).rejects.toThrow("online.offline")
  open()
  await tick()
  expect(sent).toHaveLength(4)
  requests.disconnected()
  expect((await settled).every((result) => result.status === "rejected")).toBe(true)
  expect(requests.size).toBe(0)
  const offline = setup(10)
  await expect(offline.requests.request("alice", { type: "profile.read", input: {} })).rejects.toThrow("online.offline")
})

test("large commands and out-of-order responses travel in fragments; a changed account cannot send", async () => {
  const { requests, state, sent, open, tick } = setup()
  open()
  const command = { type: "trade.prepare" as const, input: { payload: "🙂".repeat(7000) } }
  const task = requests.request("alice", command)
  await tick()
  expect(sent.length).toBeGreaterThan(1)
  const assembly = new SocketAssembly()
  let source: string | undefined
  for (const frame of sent) source = assembly.add(frame.fragment)
  expect(JSON.parse(source!)).toEqual(command)
  const body = { result: "á".repeat(30_000) }
  for (const fragment of socketParts(body, 100_000).reverse())
    requests.receive({ kind: "response-part", requestId: sent[0]!.requestId, status: 200, fragment })
  expect(await (await task).json()).toEqual(body)
  state.account = "bob"
  const count = sent.length
  await expect(requests.request("alice", command)).rejects.toThrow("online.saveChanged")
  expect(sent).toHaveLength(count)
})
