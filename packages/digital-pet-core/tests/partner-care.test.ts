import { expect, test } from "bun:test"
import type { HygieneSnapshot, PartnerHygieneStore } from "../src/application/ports/partner-hygiene.ts"
import { createPartnerHygieneService } from "../src/application/use-cases/care-for-partner.ts"
import { DIGIMON_CATALOG } from "../src/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "../src/domain/evolution.ts"

test("partner care works through a storage port with injected thresholds, including a normal evolution check", () => {
  let snapshot: HygieneSnapshot = {
    partner: {
      partnerId: "pet",
      generation: 1,
      currentNodeId: "3-001",
      gauge: 90,
      isTerminal: false,
      pendingEvolutionTargetId: null,
      battleOpponentNodeId: null,
      createdAt: new Date(0).toISOString(),
      retiredAt: null,
    },
    frozen: false,
    isSetOverride: false,
    hygiene: { poops: [1, 2, 3], nextAt: null, happyUntil: 0 },
  }
  const store: PartnerHygieneStore = {
    updateHygiene: (change) => {
      const next = change(snapshot)
      if (!next) return undefined
      snapshot = { ...snapshot, hygiene: next.hygiene, partner: { ...snapshot.partner, ...next.progression } }
      return { partnerId: snapshot.partner.partnerId, hygiene: next.hygiene }
    },
  }
  const thresholds = Object.freeze({ ...STAGE_GAUGE_THRESHOLDS, 3: 100 })
  const care = createPartnerHygieneService(store, DIGIMON_CATALOG, thresholds, () => 0)
  expect(care.cleanPoop("pet", 1, 100)).toBe(true)
  expect(snapshot.partner.gauge).toBe(95)
  expect(care.cleanPoop("pet", 1, 100)).toBe(false)
  snapshot = { ...snapshot, frozen: true }
  expect(care.cleanPoop("pet", 2, 100)).toBe(false)
  snapshot = { ...snapshot, frozen: false, isSetOverride: true }
  expect(care.cleanPoop("pet", 2, 100)).toBe(false)
  snapshot = { ...snapshot, isSetOverride: false }
  expect(care.cleanPoop("old-partner", 2, 100)).toBe(false)
  expect(care.cleanPoop("pet", 2, 100)).toBe(true)
  expect(snapshot.partner.gauge).toBe(100)
  expect(snapshot.partner.pendingEvolutionTargetId).not.toBeNull()
  expect(snapshot.partner.battleOpponentNodeId).not.toBeNull()
  expect(care.cleanPoop("pet", 3, 100)).toBe(false)
  expect(snapshot.hygiene?.poops).toEqual([3])
})
