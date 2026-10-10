import { expect, test } from "bun:test"
import { createEggPettingService } from "@jcendal/digital-pet-core/application/use-cases/pet-egg.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"
import { createSqliteDigitalPetRepository } from "../../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { createTempTestRoot, removeTempTestRoot } from "./persistence-fixtures.ts"

test("Cursor saves egg clicks once and respects pause, overrides, and partner identity", async () => {
  const root = await createTempTestRoot()
  const now = Date.now()
  const options = { appDataRoot: root.appDataRoot }
  let repository = await createSqliteDigitalPetRepository(options)
  const service = () => createEggPettingService(repository, DIGIMON_CATALOG, STAGE_GAUGE_THRESHOLDS)
  const spawn = (currentNodeId = "0-001", gauge = 0) =>
    repository.spawnPartner({ currentNodeId, gauge, isTerminal: false, createdAt: new Date(now).toISOString() })
  try {
    const partner = spawn()
    expect(service().petEgg(partner.partnerId, "first", now)).toEqual({ accepted: true })
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[0] * 0.01)
    expect(service().petEgg(partner.partnerId, "first", now)).toEqual({ accepted: false })
    expect(repository.listPartnerEvents(partner.partnerId)).toHaveLength(2)
    expect(repository.getTrainerState().totalTokens).toBe(0)
    expect(repository.listUsageReceipts()).toEqual([])
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[0] * 0.01)
    expect(service().petEgg(partner.partnerId, "first", now)).toEqual({ accepted: false })
    repository.freeze()
    expect(service().petEgg(partner.partnerId, "paused", now)).toEqual({ accepted: false })
    repository.unfreeze()
    expect(service().petEgg(partner.partnerId, "paused", now)).toEqual({ accepted: true })
    repository.setCheatNode("0-001")
    expect(service().petEgg(partner.partnerId, "override", now)).toEqual({ accepted: false })
    const replacement = spawn()
    expect(service().petEgg(partner.partnerId, "stale", now)).toEqual({ accepted: false })
    expect(repository.getActivePartner()?.gauge).toBe(0)
    expect(service().petEgg(replacement.partnerId, "replacement", now)).toEqual({ accepted: true })
    const adult = spawn("3-001")
    expect(service().petEgg(adult.partnerId, "adult", now)).toEqual({ accepted: false })
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("Cursor hatches at 100% through the existing evolution flow and stops egg rewards", async () => {
  const root = await createTempTestRoot()
  const repository = await createSqliteDigitalPetRepository({ appDataRoot: root.appDataRoot })
  const now = Date.now()
  try {
    const partner = repository.spawnPartner({
      currentNodeId: "0-001",
      gauge: STAGE_GAUGE_THRESHOLDS[0] * 0.99,
      isTerminal: false,
      createdAt: new Date(now).toISOString(),
    })
    const service = createEggPettingService(repository, DIGIMON_CATALOG, STAGE_GAUGE_THRESHOLDS, () => 0)
    const result = service.petEgg(partner.partnerId, "hatch", now)
    const hatched = repository.getActivePartner()
    if (!hatched) throw new Error("No hatched partner")
    expect(result).toEqual({
      accepted: true,
      evolution: { fromNodeId: "0-001", toNodeId: hatched.currentNodeId },
    })
    expect(repository.getActivePartner()?.currentNodeId).not.toBe("0-001")
    expect(repository.getActivePartner()?.gauge).toBe(0)
    expect(service.petEgg(partner.partnerId, "after-hatch", now)).toEqual({ accepted: false })
    expect(service.petEgg(partner.partnerId, "hatch", now)).toEqual({ accepted: false })
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})
