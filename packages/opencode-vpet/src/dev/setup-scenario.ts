import type { SidebarSnapshot, SidebarSnapshotReader } from "@sbugallo/vpet-core/application/ports/sidebar-snapshot.ts"
import type { UsageLedger } from "@sbugallo/vpet-core/application/ports/usage-ledger.ts"
import { recordUsage } from "@sbugallo/vpet-core/application/use-cases/record-usage.ts"
import { spawnPartner } from "@sbugallo/vpet-core/application/use-cases/spawn-partner.ts"
import type { SqliteVpetWriteStore } from "@sbugallo/vpet-core/adapters/sqlite/sqlite-vpet-types.ts"
import { DIGIMON_CATALOG } from "@sbugallo/vpet-core/data/catalog.ts"
import type { StageThresholds } from "@sbugallo/vpet-core/domain/evolution.ts"
import { DIGIMON_STAGES } from "@sbugallo/vpet-core/domain/stage.ts"

const DEV_INSTANT_BATTLE_THRESHOLDS: StageThresholds = Object.freeze(
  Object.fromEntries(DIGIMON_STAGES.map((stage) => [stage, 1])) as StageThresholds,
)

export type DevScenarioRepository = SqliteVpetWriteStore & UsageLedger & SidebarSnapshotReader

const usageReceipt = (receiptKey: string, tokenDelta = 1): Parameters<typeof recordUsage>[0]["usage"] => ({
  receiptKey,
  eventId: `dev:${receiptKey}`,
  tokenDelta,
  cost: null,
  createdAt: new Date().toISOString(),
})

const applyTokenUsage = (ledger: UsageLedger, receiptKey: string, tokenDelta = 1): ReturnType<typeof recordUsage> =>
  recordUsage({
    usage: usageReceipt(receiptKey, tokenDelta),
    ledger,
    digimonById: DIGIMON_CATALOG.byId,
    catalogNodes: DIGIMON_CATALOG.nodes,
    selector: () => 0,
    thresholds: DEV_INSTANT_BATTLE_THRESHOLDS,
  })

const hasPendingBattle = (snapshot: SidebarSnapshot): boolean =>
  snapshot.pendingEvolutionTargetId !== null && snapshot.battleOpponentNodeId !== null

const assertPartnerCanBattle = (snapshot: SidebarSnapshot): void => {
  const current = DIGIMON_CATALOG.byId.get(snapshot.currentNodeId)
  if (current === undefined) {
    throw new Error(`VPet dev: partner node ${snapshot.currentNodeId} is missing from the catalog.`)
  }
  if (snapshot.frozen) {
    throw new Error("VPet dev: partner is frozen. Unfreeze before opening an evolution battle.")
  }
  if (snapshot.isSetOverride) {
    throw new Error("VPet dev: clear the digimon override before opening an evolution battle.")
  }
  if (snapshot.isTerminal || current.nextEvolutions.length === 0) {
    throw new Error("VPet dev: partner cannot evolve further, so no evolution battle can be opened.")
  }
}

export const ensureActivePartner = (repository: DevScenarioRepository): void => {
  if (repository.getActivePartner() !== null) return
  spawnPartner(repository, new Date().toISOString())
}

export const setupBattlePending = (repository: DevScenarioRepository): void => {
  ensureActivePartner(repository)
  const initialSnapshot = repository.getSidebarSnapshot()
  if (initialSnapshot === null) {
    throw new Error("VPet dev: could not read the active partner snapshot.")
  }
  if (hasPendingBattle(initialSnapshot)) return

  assertPartnerCanBattle(initialSnapshot)

  const receiptSuffix = Date.now().toString(36)
  const current = DIGIMON_CATALOG.byId.get(initialSnapshot.currentNodeId)
  if (current === undefined) {
    throw new Error(`VPet dev: partner node ${initialSnapshot.currentNodeId} is missing from the catalog.`)
  }

  if (current.stage === 0) {
    applyTokenUsage(repository, `dev-hatch-${receiptSuffix}`, 1)
  }

  const afterHatch = repository.getSidebarSnapshot()
  if (afterHatch !== null && !hasPendingBattle(afterHatch)) {
    applyTokenUsage(repository, `dev-battle-${receiptSuffix}`, 1)
  }

  const pending = repository.getSidebarSnapshot()
  if (pending === null || !hasPendingBattle(pending)) {
    throw new Error("VPet dev: could not open a pending evolution battle for the current partner.")
  }
}
