import { describe, expect, it } from "bun:test"

import { MAX_BACKUP_BYTES, parsePetTransfer } from "../src/transfer-protocol.ts"

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

  it("keeps device transfers small while allowing larger validated backup files", () => {
    const backup = { version: 1, state, ignored: "x".repeat(65_536) }
    expect(() => parsePetTransfer(backup)).toThrow("too large")
    expect(parsePetTransfer(backup, MAX_BACKUP_BYTES).state).toEqual(state)
  })

  it("rejects malformed and inconsistent histories before import", () => {
    expect(() => parsePetTransfer({ version: 2, state })).toThrow()
    expect(() => parsePetTransfer({ version: 1, state: { ...state, currentNodeId: "1-001" } })).toThrow()
    expect(() => parsePetTransfer({ version: 1, state: { ...state, gauge: -1 } })).toThrow()
    expect(() =>
      parsePetTransfer({ version: 1, state: { ...state, events: [{ ...state.events[0], createdAt: "bad" }] } }),
    ).toThrow()
  })

  it("transfers experience preferences and archived companions, and rejects invalid settings", () => {
    const extended = {
      ...state,
      experienceLevel: "low",
      retiredPartners: [
        { partnerId: "previous", createdAt: state.createdAt, retiredAt: state.createdAt, events: state.events },
      ],
    }
    expect(parsePetTransfer({ version: 1, state: extended }).state).toEqual(extended)
    expect(() => parsePetTransfer({ version: 1, state: { ...state, experienceLevel: ["low"] } })).toThrow()
    expect(() =>
      parsePetTransfer({
        version: 1,
        state: { ...extended, retiredPartners: [{ ...extended.retiredPartners[0], events: [] }] },
      }),
    ).toThrow()
  })
})
