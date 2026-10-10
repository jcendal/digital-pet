import { expect, test } from "bun:test"
import { createPartnerHygieneService } from "@jcendal/digital-pet-core/application/use-cases/care-for-partner.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"
import { createSqliteDigitalPetRepository } from "../../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { createTempTestRoot, removeTempTestRoot } from "./persistence-fixtures.ts"

test("Cursor persists piles, cleans once, rewards stage XP, and resets on a new partner", async () => {
  const root = await createTempTestRoot()
  const now = Date.now()
  const options = { appDataRoot: root.appDataRoot }
  let repository = await createSqliteDigitalPetRepository(options)
  const care = () => createPartnerHygieneService(repository, DIGIMON_CATALOG, STAGE_GAUGE_THRESHOLDS)
  try {
    const partner = repository.spawnPartner({
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      createdAt: new Date(now).toISOString(),
    })
    const initial = care().refreshHygiene(now)
    expect(initial?.hygiene.nextAt).toBe(now + 2 * 3_600_000)
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    const full = care().refreshHygiene(now + 26 * 3_600_000)
    expect(full?.hygiene.poops).toHaveLength(3)
    const id = full?.hygiene.poops[0]
    if (id === undefined) throw new Error("No saved pile")
    const cleanAt = now + 27 * 3_600_000
    expect(care().cleanPoop(partner.partnerId, id, cleanAt)).toBe(true)
    expect(care().cleanPoop(partner.partnerId, id, cleanAt)).toBe(false)
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[3] * 0.05)
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    expect(care().refreshHygiene(cleanAt)?.hygiene.poops).toHaveLength(2)
    expect(care().refreshHygiene(cleanAt)?.hygiene.happyUntil).toBe(cleanAt + 3_000)
    repository.spawnPartner({
      currentNodeId: "0-001",
      gauge: 0,
      isTerminal: false,
      createdAt: new Date(cleanAt).toISOString(),
    })
    expect(care().refreshHygiene(cleanAt)).toBeUndefined()
    expect(care().cleanPoop(partner.partnerId, id, cleanAt)).toBe(false)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})
