import { expect, test } from "bun:test"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { buildDexViewModel } from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"
import { DEFAULT_WORLD_VISIT } from "@jcendal/digital-pet-fields/application/world.ts"
import { archiveFor, settingsFor } from "../../../src/domain/pet/models.ts"
import { advanceLocalPet, type LocalPetState, replaceLocalPartner } from "../../../src/domain/pet/progress.ts"
import { parsePetTransfer } from "../../../src/domain/transfer/protocol.ts"

test("adoption preserves the owned Dex, archive and settings, and starts fresh care timers", () => {
  const now = Date.parse("2026-10-11T10:00:00.000Z")
  const createdAt = new Date(now - 24 * 3600_000).toISOString()
  const old: LocalPetState = {
    partnerId: "previous",
    currentNodeId: "3-001",
    gauge: 2_000_000,
    createdAt,
    lastTickAt: now,
    isTerminal: false,
    events: [
      { currentNodeId: "0-001", createdAt },
      { currentNodeId: "3-001", createdAt: new Date(now - 600_000).toISOString() },
    ],
    experienceLevel: "normal",
    worldVisit: DEFAULT_WORLD_VISIT,
    food: { kind: "available" },
  }
  const adopted = replaceLocalPartner(old, "adopted", now, "3-007", false)
  expect(adopted.gauge).toBe(0)
  expect(adopted.worldVisit).toEqual(old.worldVisit)
  expect(adopted.experienceLevel).toBe("normal")
  expect(adopted.retiredPartners?.[0]?.events).toEqual(old.events)
  expect(adopted.pendingEvolution).toBeUndefined()
  expect(adopted.food).toBeUndefined()
  expect(adopted.hygiene).toBeUndefined()
  const cared = advanceLocalPet(adopted, now, () => 0)
  expect(cared.food?.kind).not.toBe("available")
  expect(cared.hygiene?.poops ?? []).toHaveLength(0)
  const dex = buildDexViewModel(archiveFor(adopted), DIGIMON_CATALOG, settingsFor(adopted))
  if (dex.kind !== "available") throw new Error("Missing adopted archive")
  for (const id of ["0-001", "3-001", "3-007"]) expect(dex.rows.find((node) => node.id === id)?.discovered).toBe(true)
  expect(parsePetTransfer({ version: 1, state: adopted }).state).toEqual(adopted)
})
