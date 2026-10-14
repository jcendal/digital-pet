import { describe, expect, it } from "bun:test"
import { advanceLocalPet } from "../../../src/domain/pet/progress.ts"
import { MAX_BACKUP_BYTES, parsePetTransfer } from "../../../src/domain/transfer/protocol.ts"

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
  it("round-trips a targetless duel with its form victories and rejects invalid counters", () => {
    const duel = {
      ...state,
      currentNodeId: "4-077",
      combatVictories: 11,
      events: [{ createdAt: state.createdAt, currentNodeId: "4-077" }],
      pendingEvolution: { targetNodeId: null, opponentNodeId: "4-001", readyAt: state.lastTickAt },
    }
    expect(parsePetTransfer({ version: 3, state: duel }).state).toEqual(duel)
    for (const combatVictories of [-1, 1.5, "12", 1_000_001])
      expect(() => parsePetTransfer({ version: 3, state: { ...duel, combatVictories } })).toThrow()
    expect(() =>
      parsePetTransfer({
        version: 3,
        state: { ...duel, pendingEvolution: { ...duel.pendingEvolution, opponentNodeId: "3-001" } },
      }),
    ).toThrow()
    expect(() =>
      parsePetTransfer({ version: 3, state: { ...state, pendingEvolution: duel.pendingEvolution } }),
    ).toThrow()
  })

  it("preserves a pending evolution through transfer and rejects unrelated targets", () => {
    const pending = advanceLocalPet({ ...state, gauge: 5_000_000 }, Date.now(), () => 0)
    expect(pending.pendingEvolution).toBeDefined()
    expect(parsePetTransfer({ version: 1, state: pending }).state).toEqual(pending)
    expect(() =>
      parsePetTransfer({
        version: 1,
        state: { ...pending, pendingEvolution: { ...pending.pendingEvolution, targetNodeId: "7-001" } },
      }),
    ).toThrow("pending evolution")
  })
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
    expect(() => parsePetTransfer({ version: 4, state })).toThrow()
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
