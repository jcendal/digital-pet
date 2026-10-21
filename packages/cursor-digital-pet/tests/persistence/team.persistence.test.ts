import { expect, test } from "bun:test"
import { join } from "node:path"
import { createSqliteAdventureStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-adventure-store.ts"
import { createSqliteDigitalPetWriteStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { runMigrations } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-migrations.ts"
import { createPartnerHygieneService } from "@jcendal/digital-pet-core/application/use-cases/care-for-partner.ts"
import { createAdventureService } from "@jcendal/digital-pet-core/application/use-cases/explore-adventure.ts"
import { recordUsage } from "@jcendal/digital-pet-core/application/use-cases/record-usage.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"
import type { PartnerTeam } from "@jcendal/digital-pet-core/domain/partner-team.ts"
import { createSqliteDigitalPetRepository } from "../../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { openWritableSqliteDatabase } from "../../src/adapters/sqlite/sqlite-driver.ts"
import { createTempTestRoot, removeTempTestRoot } from "./persistence-fixtures.ts"

const expectation = (team: PartnerTeam) => ({
  expectedRevision: team.revision,
  expectedPrincipalId: team.principal?.partnerId ?? null,
  expectedReserveId: team.reserve?.partnerId ?? null,
})

test("migration 12 resumes living final forms in both slots without changing history, EXP or pending targets", async () => {
  const root = await createTempTestRoot()
  const databasePath = join(root.appDataRoot, "legacy-final.db")
  const database = openWritableSqliteDatabase(databasePath)
  try {
    const store = createSqliteDigitalPetWriteStore({ databasePath, executor: database.executor, close: () => {} })
    store.spawnPartner({ currentNodeId: "4-133", gauge: 123, isTerminal: true, createdAt: new Date(0).toISOString() })
    store.applyTeamCommand(
      {
        ...expectation(store.readTeam()),
        kind: "place",
        slot: "reserve",
        partner: { currentNodeId: "5-133", gauge: 456, isTerminal: true, createdAt: new Date(0).toISOString() },
      },
      0,
    )
    database.executor.run(
      "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('retired-final', 3, '7-011', 0, 1, '2026-10-01', '2026-10-02')",
    )
    const events = database.executor.all("SELECT * FROM partner_events ORDER BY event_id")
    const before = store.readTeam()
    database.executor.run("DELETE FROM schema_migrations WHERE version = 12")
    const versions = runMigrations(database.executor)
    expect(versions.at(-1)).toBe(12)
    expect(store.readTeam()).toEqual({
      ...before,
      principal: { ...before.principal!, isTerminal: false },
      reserve: { ...before.reserve!, isTerminal: false },
    })
    expect(database.executor.get("SELECT is_terminal FROM partners WHERE partner_id = 'retired-final'")).toEqual({
      is_terminal: 1,
    })
    expect(database.executor.all("SELECT * FROM partner_events ORDER BY event_id")).toEqual(events)
    expect(runMigrations(database.executor)).toEqual(versions)
    recordUsage({
      ledger: store,
      usage: {
        receiptKey: "resumed",
        eventId: "resumed",
        tokenDelta: STAGE_GAUGE_THRESHOLDS[4],
        createdAt: new Date(1000).toISOString(),
      },
      digimonById: DIGIMON_CATALOG.byId,
      catalogNodes: DIGIMON_CATALOG.nodes,
      thresholds: STAGE_GAUGE_THRESHOLDS,
      selector: () => 0,
    })
    expect(store.getActivePartner()?.battleOpponentNodeId).not.toBeNull()
    expect(store.completeEvolutionBattle(true, new Date(2000).toISOString()).kind).toBe("won_without_evolution")
    expect(store.getActivePartner()).toMatchObject({ currentNodeId: "4-133", gauge: 0, isTerminal: false })
  } finally {
    database.close()
    await removeTempTestRoot(root)
  }
})

test("two owned companions survive reopen and only the selected principal earns token receipts", async () => {
  const root = await createTempTestRoot()
  const options = { appDataRoot: root.appDataRoot }
  let repository = await createSqliteDigitalPetRepository(options)
  const now = Date.now()
  try {
    const principal = repository.spawnPartner({
      currentNodeId: "3-001",
      gauge: 123,
      isTerminal: false,
      createdAt: new Date(now).toISOString(),
    })
    expect(repository.readTeam().reserve).toBeNull()
    expect(
      repository.applyTeamCommand(
        {
          ...expectation(repository.readTeam()),
          kind: "place",
          slot: "reserve",
          partner: { currentNodeId: "3-022", gauge: 456, isTerminal: false, createdAt: new Date(now).toISOString() },
        },
        now,
      ).kind,
    ).toBe("applied")
    const before = repository.readTeam()
    expect(before.principal?.partnerId).toBe(principal.partnerId)
    expect(repository.listPartners().filter((partner) => partner.retiredAt === null)).toHaveLength(2)
    const command = { ...expectation(before), kind: "switch" } as const
    expect(repository.applyTeamCommand(command, now + 1000).kind).toBe("applied")
    expect(repository.applyTeamCommand(command, now + 1000)).toEqual({ kind: "rejected", reason: "stale" })
    recordUsage({
      ledger: repository,
      usage: {
        receiptKey: "team-tokens",
        eventId: "team-tokens",
        tokenDelta: 100,
        cost: null,
        createdAt: new Date(now + 1000).toISOString(),
      },
      digimonById: DIGIMON_CATALOG.byId,
      catalogNodes: DIGIMON_CATALOG.nodes,
      thresholds: STAGE_GAUGE_THRESHOLDS,
      selector: () => 0,
    })
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    const loaded = repository.readTeam()
    expect(loaded.principal?.partnerId).toBe(before.reserve?.partnerId)
    expect(loaded.principal?.gauge).toBe(556)
    expect(loaded.reserve?.gauge).toBe(123)
    expect(loaded.reserve?.retiredAt).toBeNull()
    expect(repository.getSidebarSnapshot()?.currentNodeId).toBe("3-022")
    expect(repository.applyTeamCommand({ ...expectation(loaded), kind: "switch" }, now + 2000).kind).toBe("applied")
    expect(repository.getActivePartner()?.partnerId).toBe(principal.partnerId)
    expect(repository.listUsageReceipts()).toHaveLength(1)
    expect(repository.listPartnerEvents(principal.partnerId).some((event) => event.kind === "retired")).toBe(false)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("reserve rest pauses care for days without removing existing piles or resetting remaining time", async () => {
  const root = await createTempTestRoot()
  const repository = await createSqliteDigitalPetRepository({ appDataRoot: root.appDataRoot })
  const now = Date.now()
  const hour = 3_600_000
  const care = createPartnerHygieneService(repository, DIGIMON_CATALOG, STAGE_GAUGE_THRESHOLDS)
  try {
    repository.spawnPartner({
      currentNodeId: "3-001",
      gauge: 0,
      isTerminal: false,
      createdAt: new Date(now).toISOString(),
    })
    care.refreshHygiene(now)
    const hygiene = care.refreshHygiene(now + 3 * hour)?.hygiene
    expect(hygiene?.poops).toHaveLength(1)
    repository.applyTeamCommand(
      {
        ...expectation(repository.readTeam()),
        kind: "place",
        slot: "reserve",
        partner: { currentNodeId: "3-022", gauge: 0, isTerminal: false, createdAt: new Date(now).toISOString() },
      },
      now + 3 * hour,
    )
    repository.applyTeamCommand({ ...expectation(repository.readTeam()), kind: "switch" }, now + 3 * hour)
    const resumedAt = now + 100 * hour
    expect(repository.applyTeamCommand({ ...expectation(repository.readTeam()), kind: "switch" }, resumedAt).kind).toBe(
      "applied",
    )
    const resumed = care.refreshHygiene(resumedAt)?.hygiene
    expect(resumed?.poops).toEqual(hygiene?.poops)
    expect(resumed?.nextAt).toBe(resumedAt + 7 * hour)
    expect(care.refreshHygiene(resumedAt + 6 * hour)?.hygiene.poops).toHaveLength(1)
    expect(care.refreshHygiene(resumedAt + 7 * hour)?.hygiene.poops).toHaveLength(2)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("replacing reserve archives only that slot and legacy principal replacement keeps reserve", async () => {
  const root = await createTempTestRoot()
  const repository = await createSqliteDigitalPetRepository({ appDataRoot: root.appDataRoot })
  const now = Date.now()
  const input = { currentNodeId: "3-001", gauge: 10, isTerminal: false, createdAt: new Date(now).toISOString() }
  try {
    const principal = repository.spawnPartner(input)
    repository.applyTeamCommand(
      { ...expectation(repository.readTeam()), kind: "place", slot: "reserve", partner: input },
      now,
    )
    const previous = repository.readTeam().reserve
    if (!previous) throw new Error("Missing reserve companion")
    repository.applyTeamCommand(
      {
        ...expectation(repository.readTeam()),
        kind: "place",
        slot: "reserve",
        partner: { ...input, currentNodeId: "3-022" },
      },
      now + 1000,
    )
    const reserve = repository.readTeam().reserve
    expect(repository.readTeam().principal?.partnerId).toBe(principal.partnerId)
    expect(repository.getPartnerByGeneration(previous.generation)?.retiredAt).not.toBeNull()
    repository.spawnPartner({ ...input, currentNodeId: "0-001" })
    expect(repository.readTeam().reserve?.partnerId).toBe(reserve?.partnerId)
    expect(repository.listPartners().filter((partner) => partner.retiredAt === null)).toHaveLength(2)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("migrating a legacy save keeps its active companion, gauge and archive and opens an empty reserve", async () => {
  const root = await createTempTestRoot()
  const databasePath = join(root.appDataRoot, "legacy-team.db")
  const database = openWritableSqliteDatabase(databasePath)
  try {
    runMigrations(database.executor)
    database.executor.run("DROP TABLE partner_team")
    database.executor.run("DROP TRIGGER partners_limit_owned_insert")
    database.executor.run("DROP TRIGGER partners_limit_owned_restore")
    database.executor.run("CREATE UNIQUE INDEX partners_one_active_partner ON partners ((1)) WHERE retired_at IS NULL")
    database.executor.run("DELETE FROM schema_migrations WHERE version = 9")
    database.executor.run(
      "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('old-retired', 1, '3-022', 999, 0, '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z')",
    )
    database.executor.run(
      "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at, retired_at) VALUES ('old-active', 2, '4-046', 123456, 0, '2026-10-02T00:00:00Z', NULL)",
    )
    const legacy = database.executor.all("SELECT * FROM partners ORDER BY generation")
    const store = createSqliteDigitalPetWriteStore({ databasePath, executor: database.executor, close: () => {} })
    expect(store.readTeam().principal?.partnerId).toBe("old-active")
    expect(store.readTeam().principal?.gauge).toBe(123456)
    expect(store.readTeam().reserve).toBeNull()
    expect(store.readTeam().revision).toBe(0)
    expect(database.executor.all("SELECT * FROM partners ORDER BY generation")).toEqual(legacy)
    runMigrations(database.executor)
    expect(store.readTeam().principal?.partnerId).toBe("old-active")
  } finally {
    database.close()
    await removeTempTestRoot(root)
  }
})

test("a failed team replacement rolls retirement and generation creation back together", async () => {
  const root = await createTempTestRoot()
  const databasePath = join(root.appDataRoot, "rollback-team.db")
  const database = openWritableSqliteDatabase(databasePath)
  let fail = false
  const executor = {
    ...database.executor,
    run: (sql: string, params: Parameters<typeof database.executor.run>[1]) => {
      if (fail && sql.includes("UPDATE partner_team SET reserve_id")) throw new Error("injected team write failure")
      database.executor.run(sql, params)
    },
  }
  const store = createSqliteDigitalPetWriteStore({ databasePath, executor, close: () => {} })
  const now = Date.now()
  const input = { currentNodeId: "3-001", gauge: 0, isTerminal: false, createdAt: new Date(now).toISOString() }
  try {
    store.spawnPartner(input)
    store.applyTeamCommand({ ...expectation(store.readTeam()), kind: "place", slot: "reserve", partner: input }, now)
    const before = store.readTeam()
    const reserve = before.reserve
    if (!reserve) throw new Error("Missing reserve companion")
    const events = store.listPartnerEvents(reserve.partnerId)
    fail = true
    expect(() =>
      store.applyTeamCommand({ ...expectation(before), kind: "place", slot: "reserve", partner: input }, now + 1000),
    ).toThrow("injected team write failure")
    expect(store.readTeam()).toEqual(before)
    expect(store.listPartners()).toHaveLength(2)
    expect(store.listPartnerEvents(reserve.partnerId)).toEqual(events)
    expect(() =>
      database.executor.run(
        "INSERT INTO partners (partner_id, generation, current_node_id, gauge, is_terminal, created_at) VALUES ('third', 3, '3-001', 0, 0, '2026-10-14T00:00:00Z')",
      ),
    ).toThrow("A team can own at most two partners")
  } finally {
    database.close()
    await removeTempTestRoot(root)
  }
})

test("team commands reject frozen mode and pending evolution without modifying either slot", async () => {
  const root = await createTempTestRoot()
  const repository = await createSqliteDigitalPetRepository({ appDataRoot: root.appDataRoot })
  const now = Date.now()
  const input = { currentNodeId: "3-001", gauge: 0, isTerminal: false, createdAt: new Date(now).toISOString() }
  try {
    repository.spawnPartner(input)
    repository.applyTeamCommand(
      { ...expectation(repository.readTeam()), kind: "place", slot: "reserve", partner: input },
      now,
    )
    repository.freeze()
    const frozen = repository.readTeam()
    expect(repository.applyTeamCommand({ ...expectation(frozen), kind: "switch" }, now)).toEqual({
      kind: "rejected",
      reason: "busy",
    })
    expect(repository.readTeam()).toEqual(frozen)
    repository.unfreeze()
    repository.applyUsageReceipt(
      {
        receiptKey: "pending-team",
        eventId: "pending-team",
        tokenDelta: 1,
        cost: null,
        createdAt: new Date(now).toISOString(),
      },
      (partner) => ({ ...partner, pendingEvolutionTargetId: "4-054", battleOpponentNodeId: "3-022" }),
    )
    const pending = repository.readTeam()
    expect(repository.applyTeamCommand({ ...expectation(pending), kind: "switch" }, now)).toEqual({
      kind: "rejected",
      reason: "busy",
    })
    expect(repository.readTeam()).toEqual(pending)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("each companion retains its own adventure cooldown through switches and reopening", async () => {
  const root = await createTempTestRoot()
  const options = { appDataRoot: root.appDataRoot }
  let repository = await createSqliteDigitalPetRepository(options)
  const service = () => createAdventureService(repository, DIGIMON_CATALOG, () => [])
  const hour = 3_600_000
  try {
    const input = { currentNodeId: "3-001", gauge: 0, isTerminal: false, createdAt: new Date(0).toISOString() }
    const principal = repository.spawnPartner(input)
    repository.applyTeamCommand(
      {
        ...expectation(repository.readTeam()),
        kind: "place",
        slot: "reserve",
        partner: { ...input, currentNodeId: "3-022" },
      },
      0,
    )
    await service().act({ kind: "start", id: "principal-trip" }, 0)
    await service().act({ kind: "stop" }, 0)
    expect(await service().nextReadyAt()).toBe(2 * hour)
    expect(repository.applyTeamCommand({ ...expectation(repository.readTeam()), kind: "switch" }, 0).kind).toBe(
      "applied",
    )
    expect(await service().nextReadyAt()).toBe(0)
    await service().act({ kind: "start", id: "reserve-trip" }, 1000)
    await service().act({ kind: "pause" }, 1000)
    expect(await service().nextReadyAt()).toBe(2 * hour + 1000)
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    expect(await service().nextReadyAt()).toBe(2 * hour + 1000)
    expect(repository.applyTeamCommand({ ...expectation(repository.readTeam()), kind: "switch" }, hour).kind).toBe(
      "applied",
    )
    expect(repository.getActivePartner()?.partnerId).toBe(principal.partnerId)
    expect(await service().nextReadyAt()).toBe(2 * hour)
    expect(await service().act({ kind: "start", id: "too-early" }, hour + 500)).toBeUndefined()
    expect(
      repository.applyTeamCommand({ ...expectation(repository.readTeam()), kind: "switch" }, hour + 1000).kind,
    ).toBe("applied")
    expect(await service().nextReadyAt()).toBe(2 * hour + 1000)
    expect(repository.applyTeamCommand({ ...expectation(repository.readTeam()), kind: "switch" }, 3 * hour).kind).toBe(
      "applied",
    )
    expect(await service().nextReadyAt()).toBe(2 * hour)
    expect(await service().act({ kind: "start", id: "ready-after-reserve" }, 3 * hour)).toBeDefined()
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})

test("migration 11 assigns the legacy global cooldown only to the principal and is idempotent", async () => {
  const root = await createTempTestRoot()
  const databasePath = join(root.appDataRoot, "legacy-adventure.db")
  const database = openWritableSqliteDatabase(databasePath)
  try {
    const store = createSqliteDigitalPetWriteStore({ databasePath, executor: database.executor, close: () => {} })
    const input = { currentNodeId: "3-001", gauge: 0, isTerminal: false, createdAt: new Date(0).toISOString() }
    const principal = store.spawnPartner(input)
    store.applyTeamCommand({ ...expectation(store.readTeam()), kind: "place", slot: "reserve", partner: input }, 0)
    database.executor.run("DROP TABLE partner_adventure_schedule")
    database.executor.run("DELETE FROM schema_migrations WHERE version = 11")
    database.executor.run(
      "CREATE TABLE adventure_schedule (schedule_id INTEGER PRIMARY KEY, ready_at INTEGER NOT NULL)",
    )
    database.executor.run("INSERT INTO adventure_schedule VALUES (1, 7200000)")
    const applied = runMigrations(database.executor)
    expect(applied.at(-1)).toBe(12)
    expect(database.executor.all("SELECT * FROM partner_adventure_schedule")).toEqual([
      { partner_id: principal.partnerId, ready_at: 7200000 },
    ])
    expect(runMigrations(database.executor)).toEqual(applied)
    expect(await createSqliteAdventureStore(database.executor, "digital-ocean").nextReadyAt()).toBe(7200000)
  } finally {
    database.close()
    await removeTempTestRoot(root)
  }
})
