import { describe, expect, it } from "bun:test"

import { parsePetTransfer } from "../src/transfer-protocol.ts"

const state = {
  partnerId: "sample-partner",
  createdAt: "2026-10-07T00:00:00.000Z",
  currentNodeId: "0-001",
  gauge: 0,
  isTerminal: false,
  lastTickAt: Date.parse("2026-10-07T00:00:00.000Z"),
  events: [{ currentNodeId: "0-001", createdAt: "2026-10-07T00:00:00.000Z" }],
}

describe("browser save transfer", () => {
  it("accepts a versioned save and discards unknown fields", () => {
    const transfer = parsePetTransfer({ version: 1, state: { ...state, unwanted: "data" } })
    expect(transfer.state).toEqual(state)
  })

  it("rejects malformed and inconsistent histories before import", () => {
    expect(() => parsePetTransfer({ version: 2, state })).toThrow()
    expect(() => parsePetTransfer({ version: 1, state: { ...state, currentNodeId: "1-001" } })).toThrow()
    expect(() => parsePetTransfer({ version: 1, state: { ...state, gauge: -1 } })).toThrow()
    expect(() =>
      parsePetTransfer({ version: 1, state: { ...state, events: [{ ...state.events[0], createdAt: "bad" }] } }),
    ).toThrow()
  })
})
