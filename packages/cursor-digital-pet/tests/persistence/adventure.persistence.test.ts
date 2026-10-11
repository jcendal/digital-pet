import { expect, test } from "bun:test"
import { createAdventureService } from "@jcendal/digital-pet-core/application/use-cases/explore-adventure.ts"
import { DEFAULT_DIGITAL_PET_SETTINGS } from "@jcendal/digital-pet-core/config/defaults.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"
import { buildDexViewModel } from "@jcendal/digital-pet-core/view-models/dex-view-model.ts"
import { getRegionResidents } from "@jcendal/digital-pet-fields/application/world.ts"
import { readArchive } from "../../src/adapters/sqlite/sqlite-digital-pet-archive-reader.ts"
import { createSqliteDigitalPetRepository } from "../../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { createTempTestRoot, removeTempTestRoot } from "./persistence-fixtures.ts"

test("Cursor stores the route across restarts and rewards a find once in the existing progression", async () => {
  const root = await createTempTestRoot()
  const options = { appDataRoot: root.appDataRoot }
  let repository = await createSqliteDigitalPetRepository(options)
  const service = () =>
    createAdventureService(
      repository,
      DIGIMON_CATALOG,
      (regionId) => getRegionResidents(regionId, DIGIMON_CATALOG),
      () => 0.9,
    )
  try {
    const partner = repository.spawnPartner({
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      createdAt: new Date(0).toISOString(),
    })
    await service().act({ kind: "start", id: "route" }, 0)
    for (let now = 1000; now <= 63_000; now += 1000) await service().act({ kind: "tick" }, now)
    const saved = await service().act({ kind: "read" }, 63_000)
    expect(saved?.event?.kind).toBe("loot")
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    expect(await service().act({ kind: "read" }, 63_000)).toEqual(saved)
    await service().act({ kind: "collect", eventId: 1 }, 63_000)
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[3] * 0.02)
    await service().act({ kind: "collect", eventId: 1 }, 63_000)
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[3] * 0.02)
    expect(repository.listPartnerEvents(partner.partnerId)).toHaveLength(2)
    expect(repository.getTrainerState().totalTokens).toBe(0)
    repository.freeze()
    const paused = await service().act({ kind: "tick" }, 64_000)
    expect(paused?.running).toBe(false)
    repository.unfreeze()
    await service().act({ kind: "resume" }, 90_000)
    expect((await service().act({ kind: "tick" }, 91_000))?.elapsedMs).toBe(64_000)
    repository.spawnPartner({
      currentNodeId: "0-001",
      gauge: 0,
      isTerminal: false,
      createdAt: new Date(100_000).toISOString(),
    })
    expect(await service().act({ kind: "collect", eventId: 1 }, 100_000)).toBeUndefined()
    expect(repository.getActivePartner()?.gauge).toBe(0)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("Cursor persists battle rolls and checkpoints, defers XP, and pauses a trip at an evolution threshold", async () => {
  const root = await createTempTestRoot()
  const options = { appDataRoot: root.appDataRoot }
  let repository = await createSqliteDigitalPetRepository(options)
  const service = (random = () => 0) =>
    createAdventureService(
      repository,
      DIGIMON_CATALOG,
      (regionId) => getRegionResidents(regionId, DIGIMON_CATALOG),
      random,
    )
  try {
    repository.spawnPartner({
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      createdAt: new Date(0).toISOString(),
    })
    await service().act({ kind: "start", id: "battle-route" }, 0)
    for (let now = 1000; now <= 45_000; now += 1000) await service().act({ kind: "tick" }, now)
    const saved = await service().act({ kind: "read" }, 45_000)
    if (saved?.event?.kind !== "battle") throw new Error("Missing battle encounter")
    expect(saved.event.difficult).toBe(true)
    expect(saved.event.plan.outcome).toBe("player")
    expect(repository.getActivePartner()?.gauge).toBe(0)
    await service().act({ kind: "checkpoint", eventId: 1, completedShots: 2, adventureId: saved.id }, 50_000)
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    const restored = await service().act({ kind: "read" }, 50_000)
    if (restored?.event?.kind !== "battle") throw new Error("Missing saved battle")
    expect(restored.event.plan).toEqual(saved.event.plan)
    expect(restored.event.completedShots).toBe(2)
    await service().act({ kind: "finish-battle", eventId: 1, adventureId: saved.id }, 50_000)
    expect(repository.getActivePartner()?.gauge).toBe(0)
    await service().act(
      { kind: "checkpoint", eventId: 1, completedShots: restored.event.plan.shots.length, adventureId: saved.id },
      52_000,
    )
    await service().act({ kind: "finish-battle", eventId: 1, adventureId: saved.id }, 55_000)
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[3] * 0.1)
    await service().act({ kind: "finish-battle", eventId: 1, adventureId: saved.id }, 55_000)
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[3] * 0.1)
    const offer = await service().act({ kind: "read" }, 55_000)
    if (offer?.event?.kind !== "offer") throw new Error("Missing companion offer")
    const defeatedNodeId = offer.event.opponentNodeId
    const oldPartner = repository.getActivePartner()!
    const cooldown = await service().nextReadyAt()
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    expect((await service().act({ kind: "read" }, 56_000))?.event).toEqual(offer.event)
    const choice = { kind: "accept-companion" as const, eventId: offer.event.id, adventureId: offer.id }
    await service().act(choice, 57_000)
    const adopted = repository.getActivePartner()!
    expect(adopted.currentNodeId).toBe(defeatedNodeId)
    expect(adopted.generation).toBe(oldPartner.generation + 1)
    expect(adopted.gauge).toBe(0)
    expect(adopted.pendingEvolutionTargetId).toBeNull()
    expect(repository.getPartnerByGeneration(oldPartner.generation)?.retiredAt).not.toBeNull()
    expect(repository.listPartnerEvents(oldPartner.partnerId).some((event) => event.kind === "retired")).toBe(true)
    expect(repository.listPartnerEvents(adopted.partnerId)[0]?.currentNodeId).toBe(defeatedNodeId)
    expect(repository.getTrainerState().totalTokens).toBe(0)
    await service().act(choice, 58_000)
    expect(repository.getActivePartner()?.partnerId).toBe(adopted.partnerId)
    const archive = await readArchive(options)
    const dex = buildDexViewModel(archive, DIGIMON_CATALOG, DEFAULT_DIGITAL_PET_SETTINGS)
    if (dex.kind !== "available") throw new Error("Missing adopted Dex")
    expect(dex.rows.find((node) => node.id === oldPartner.currentNodeId)?.discovered).toBe(true)
    expect(dex.rows.find((node) => node.id === adopted.currentNodeId)?.discovered).toBe(true)
    expect(await service().nextReadyAt()).toBe(cooldown)
    expect(await service().act({ kind: "start", id: "adoption-bypass" }, 58_000)).toBeUndefined()
    repository.spawnPartner({
      currentNodeId: "3-001",
      gauge: STAGE_GAUGE_THRESHOLDS[3] * 0.99,
      isTerminal: false,
      createdAt: new Date(60_000).toISOString(),
    })
    const finds = service(() => 0.9)
    const readyAt = await finds.nextReadyAt()
    expect(await finds.act({ kind: "start", id: "too-soon" }, 60_000)).toBeUndefined()
    await finds.act({ kind: "start", id: "evolve-route" }, readyAt)
    for (let now = readyAt + 1000; now <= readyAt + 63_000; now += 1000) await finds.act({ kind: "tick" }, now)
    const finished = await finds.act({ kind: "collect", eventId: 1 }, readyAt + 63_000)
    expect(finished?.running).toBe(false)
    expect(finished?.status).toBe("evolved")
    expect(repository.getActivePartner()?.pendingEvolutionTargetId).not.toBeNull()
    expect(repository.getActivePartner()?.gauge).toBe(STAGE_GAUGE_THRESHOLDS[3])
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("a victory that reaches evolution ends the trip before a recruitment offer can replace the partner", async () => {
  const root = await createTempTestRoot()
  const repository = await createSqliteDigitalPetRepository({ appDataRoot: root.appDataRoot })
  const service = createAdventureService(
    repository,
    DIGIMON_CATALOG,
    (regionId) => getRegionResidents(regionId, DIGIMON_CATALOG),
    () => 0,
  )
  try {
    const partner = repository.spawnPartner({
      currentNodeId: "3-001",
      gauge: STAGE_GAUGE_THRESHOLDS[3] * 0.99,
      isTerminal: false,
      createdAt: new Date(0).toISOString(),
    })
    await service.act({ kind: "start", id: "winning-evolution" }, 0)
    for (let now = 1000; now <= 45_000; now += 1000) await service.act({ kind: "tick" }, now)
    const trip = await service.act({ kind: "read" }, 45_000)
    if (trip?.event?.kind !== "battle") throw new Error("Missing evolution encounter")
    await service.act(
      {
        kind: "checkpoint",
        eventId: trip.event.id,
        completedShots: trip.event.plan.shots.length,
        adventureId: trip.id,
      },
      50_000,
    )
    const ended = await service.act({ kind: "finish-battle", eventId: trip.event.id, adventureId: trip.id }, 55_000)
    expect(ended?.status).toBe("evolved")
    expect(ended?.event).toBeUndefined()
    expect(ended?.running).toBe(false)
    const active = repository.getActivePartner()!
    expect(active.partnerId).toBe(partner.partnerId)
    expect(active.gauge).toBe(STAGE_GAUGE_THRESHOLDS[3])
    expect(active.pendingEvolutionTargetId).not.toBeNull()
    await service.act({ kind: "accept-companion", eventId: trip.event.id, adventureId: trip.id }, 56_000)
    expect(repository.getActivePartner()?.partnerId).toBe(partner.partnerId)
    expect(await service.nextReadyAt()).toBeGreaterThan(56_000)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})
