import { expect, test } from "bun:test"
import type { BattlePlan } from "@jcendal/digital-pet-core/domain/combat.ts"
import { type BattleMessage, BattleNegotiation, parseBattleMessage } from "../../../src/domain/battle/protocol.ts"

const battleId = "11111111-1111-4111-8111-111111111111"
const challenger = { partnerId: "alice", nodeId: "3-001" }
const receiver = { partnerId: "bob", nodeId: "4-001" }
const hash = async (text: string): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")

const pair = () => {
  const toAlice: BattleMessage[] = []
  const toBob: BattleMessage[] = []
  const results: { side: string; plan: BattlePlan }[] = []
  let requests = 0
  const alice = new BattleNegotiation(true, "ab".repeat(32), {
    hash,
    send: (message) => toBob.push(message),
    requested: () => {},
    agreed: async (id, a, b, plan) => {
      expect([id, a, b]).toEqual([battleId, challenger, receiver])
      results.push({ side: "alice", plan })
    },
  })
  const bob = new BattleNegotiation(false, "cd".repeat(32), {
    hash,
    send: (message) => toAlice.push(message),
    requested: () => {
      requests++
    },
    agreed: async (id, a, b, plan) => {
      expect([id, a, b]).toEqual([battleId, challenger, receiver])
      results.push({ side: "bob", plan })
    },
  })
  const deliver = async (side: "alice" | "bob") => {
    const message = (side === "alice" ? toAlice : toBob).shift()
    if (!message) throw new Error("No queued message")
    await (side === "alice" ? alice : bob).receive(message)
  }
  return { alice, bob, toAlice, toBob, results, deliver, requests: () => requests }
}

test("a request requires acceptance; both players verify the same full plan before starting once", async () => {
  const p = pair()
  await p.alice.start(battleId, challenger)
  await p.deliver("bob")
  expect(p.requests()).toBe(1)
  expect(p.toAlice).toHaveLength(0)
  expect(p.results).toHaveLength(0)
  await p.bob.accept(receiver)
  await p.deliver("alice") // acceptance
  await p.deliver("bob") // first reveal
  await p.deliver("alice") // second reveal
  expect(p.results).toHaveLength(0)
  const ready = p.toAlice[0]
  await p.deliver("alice") // receiver's digest
  await p.deliver("bob") // challenger's digest
  expect(p.results).toHaveLength(2)
  expect(p.results[0]?.plan).toEqual(p.results[1]?.plan)
  await p.alice.receive(ready)
  expect(p.results).toHaveLength(2)
})

test("a changed reveal, mismatched plan, wrong session and unsolicited acceptance cannot award a win", async () => {
  const p = pair()
  await p.alice.start(battleId, challenger)
  await p.deliver("bob")
  await p.bob.accept(receiver)
  await p.deliver("alice")
  await expect(p.bob.receive({ ...p.toBob[0], secret: "ef".repeat(32) })).rejects.toThrow("randomness")
  await p.deliver("bob")
  await p.deliver("alice")
  await expect(p.alice.receive({ ...p.toAlice[0], digest: "00".repeat(32) })).rejects.toThrow("do not match")
  await expect(p.alice.receive({ ...p.toAlice[0], battleId: "22222222-2222-4222-8222-222222222222" })).rejects.toThrow(
    "session",
  )
  expect(p.results).toHaveLength(0)
  await expect(pair().bob.accept(receiver)).rejects.toThrow("No battle")
})

test("decline cancels without combat; malformed, oversized and egg participants are rejected", async () => {
  const p = pair()
  await p.alice.start(battleId, challenger)
  await p.deliver("bob")
  p.bob.cancel()
  await expect(p.deliver("alice")).rejects.toThrow("cancelled")
  expect(p.results).toHaveLength(0)
  for (const fighter of [
    { ...challenger, nodeId: "0-001" },
    { ...challenger, nodeId: "unknown" },
  ])
    expect(() =>
      parseBattleMessage({ type: "request", version: 1, battleId, fighter, commitment: "ab".repeat(32) }),
    ).toThrow("hatched")
  expect(() => parseBattleMessage({ type: "cancel", version: 2, battleId })).toThrow("Unsupported")
  expect(() => parseBattleMessage({ type: "cancel", version: 1, battleId, excess: "x".repeat(2048) })).toThrow(
    "Unsupported",
  )
})
