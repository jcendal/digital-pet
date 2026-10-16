import { expect, test } from "bun:test"
import { readCombatProgress } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-combat-progress.ts"
import { createPartnerHygieneService } from "@jcendal/digital-pet-core/application/use-cases/care-for-partner.ts"
import { recordUsage } from "@jcendal/digital-pet-core/application/use-cases/record-usage.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"
import { createSqliteDigitalPetRepository } from "../../src/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { openReadonlySqliteDatabase } from "../../src/adapters/sqlite/sqlite-driver.ts"
import { createTempTestRoot, removeTempTestRoot } from "./persistence-fixtures.ts"

test("targetless victories persist and cannot be replayed onto a later duel", async () => {
  const root = await createTempTestRoot()
  const options = { appDataRoot: root.appDataRoot }
  let repository = await createSqliteDigitalPetRepository(options)
  const now = Date.now()
  try {
    const partner = repository.spawnPartner({
      currentNodeId: "4-010",
      gauge: 0,
      isTerminal: false,
      createdAt: new Date(now - 27 * 3_600_000).toISOString(),
    })
    createPartnerHygieneService(repository, DIGIMON_CATALOG, STAGE_GAUGE_THRESHOLDS).refreshHygiene(
      now - 27 * 3_600_000,
    )
    const openDuel = (id: string) =>
      recordUsage({
        ledger: repository,
        usage: {
          receiptKey: id,
          eventId: id,
          tokenDelta: STAGE_GAUGE_THRESHOLDS[4],
          createdAt: new Date(now).toISOString(),
        },
        digimonById: DIGIMON_CATALOG.byId,
        catalogNodes: DIGIMON_CATALOG.nodes,
        thresholds: STAGE_GAUGE_THRESHOLDS,
        selector: () => 0,
      })
    openDuel("first")
    const pending = repository.getActivePartner()
    if (!pending) throw new Error("Missing companion")
    const expected = { ...pending, battleId: repository.getEvolutionBattleId() }
    expect(expected.pendingEvolutionTargetId).toBeNull()
    expect(expected.battleId).not.toBeNull()
    expect(repository.completeEvolutionBattle(true, new Date(now).toISOString(), expected).kind).toBe(
      "won_without_evolution",
    )
    expect(repository.getActivePartner()?.gauge).toBe(0)
    expect(repository.completeEvolutionBattle(true, new Date(now + 1).toISOString(), expected).kind).toBe(
      "no_pending_battle",
    )
    await repository.close()
    repository = await createSqliteDigitalPetRepository(options)
    const read = () => {
      const database = openReadonlySqliteDatabase(repository.databasePath)
      try {
        return readCombatProgress(database.executor, partner.partnerId, partner.currentNodeId)
      } finally {
        database.close()
      }
    }
    expect(read().victories).toBe(1)
    expect(repository.getSidebarSnapshot()?.combatVictories).toBe(1)
    openDuel("second")
    expect(repository.getEvolutionBattleId()).not.toBe(expected.battleId)
    expect(repository.completeEvolutionBattle(true, new Date(now + 2).toISOString(), expected).kind).toBe(
      "no_pending_battle",
    )
    expect(read().victories).toBe(1)
    expect(repository.completeEvolutionBattle(false, new Date(now + 3).toISOString()).kind).toBe("lost")
    expect(read().victories).toBe(1)
    expect(repository.getActivePartner()?.gauge).toBe(0)
  } finally {
    await repository.close()
    await removeTempTestRoot(root)
  }
})
