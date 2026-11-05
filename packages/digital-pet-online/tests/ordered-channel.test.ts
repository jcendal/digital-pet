import { expect, test } from "bun:test"
import type { WireFrame } from "../src/contracts.ts"
import { OrderedChannel } from "../src/ordered-channel.ts"

test("out-of-order delivery, duplicated frames and lost acknowledgements apply each payload once", async () => {
  const frames: WireFrame[] = []
  const acknowledgements: WireFrame[] = []
  const applied: unknown[] = []
  const sender = new OrderedChannel(
    "battle-1",
    (frame) => frames.push(frame),
    async () => {},
  )
  const receiver = new OrderedChannel(
    "battle-1",
    (frame) => acknowledgements.push(frame),
    async (payload) => {
      applied.push(payload)
    },
  )
  sender.send("reveal")
  sender.send("ready")
  await receiver.receive(frames[1])
  expect(applied).toEqual([])
  await receiver.receive(frames[0])
  expect(applied).toEqual(["reveal", "ready"])
  await receiver.receive(frames[0])
  sender.resend()
  for (const frame of frames.slice(2)) await receiver.receive(frame)
  expect(applied).toEqual(["reveal", "ready"])
  for (const frame of acknowledgements) await sender.receive(frame)
  frames.length = 0
  sender.resend()
  expect(frames).toEqual([])
})

test("a failed local transaction is retried without acknowledging data that was not stored", async () => {
  let failed = true
  const acks: WireFrame[] = []
  const applied: unknown[] = []
  const receiver = new OrderedChannel(
    "channel",
    (frame) => acks.push(frame),
    async (payload) => {
      if (failed) throw new Error("disk full")
      applied.push(payload)
    },
  )
  const frame = { version: 1, channel: "channel", kind: "data", sequence: 1, payload: "gift" }
  await expect(receiver.receive(frame)).rejects.toThrow("disk full")
  expect(acks).toEqual([])
  failed = false
  await receiver.receive(frame)
  expect(applied).toEqual(["gift"])
  expect(acks).toHaveLength(1)
})

test("bounded gaps, conflicting retransmissions and wrong logical channels fail closed", async () => {
  const receiver = new OrderedChannel(
    "right",
    () => {},
    async () => {},
  )
  const frame = { version: 1, channel: "right", kind: "data", sequence: 2, payload: "original" }
  await receiver.receive(frame)
  await expect(receiver.receive({ ...frame, payload: "changed" })).rejects.toThrow("sequence-conflict")
  await expect(receiver.receive({ ...frame, channel: "wrong" })).rejects.toThrow("wrong-channel")
  await expect(receiver.receive({ ...frame, sequence: 1000 })).rejects.toThrow("sequence-gap")
  expect(() => receiver.send("🙂".repeat(10000))).toThrow("frame-too-large")
})
