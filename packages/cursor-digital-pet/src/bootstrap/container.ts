import { join } from "node:path"
import { createPartnerHygieneService } from "@jcendal/digital-pet-core/application/use-cases/care-for-partner.ts"
import { createEggPettingService } from "@jcendal/digital-pet-core/application/use-cases/pet-egg.ts"
import { DIGIMON_CATALOG } from "@jcendal/digital-pet-core/data/catalog.ts"
import { STAGE_GAUGE_THRESHOLDS } from "@jcendal/digital-pet-core/domain/evolution.ts"
import type * as vscode from "vscode"

import { createDatabaseChangeWatcher } from "../adapters/sqlite/database-change-watcher.ts"
import {
  type CursorSqliteDigitalPetRepository,
  createSqliteDigitalPetRepository,
} from "../adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { configureSqlJsWasmPath } from "../adapters/sqlite/sqljs-config.ts"
import {
  type DigitalPetExtensionSettings,
  getDigitalPetExtensionSettings,
  toDatabaseOptions,
} from "../config/extension-settings.ts"
import { DigitalPetSidebarProvider } from "../webview/digital-pet-sidebar-provider.ts"

export type DigitalPetContainer = {
  readonly repository: CursorSqliteDigitalPetRepository
  readonly sidebarProvider: DigitalPetSidebarProvider
  readonly readSettings: () => DigitalPetExtensionSettings
  readonly databaseOptions: () => ReturnType<typeof toDatabaseOptions>
  readonly refreshSidebar: () => void
}

export const createDigitalPetContainer = async (context: vscode.ExtensionContext): Promise<DigitalPetContainer> => {
  configureSqlJsWasmPath(join(context.extensionPath, "dist", "sql-wasm.wasm"))

  const readSettings = () => getDigitalPetExtensionSettings()
  const databaseOptions = () => toDatabaseOptions(readSettings())

  const repository = await createSqliteDigitalPetRepository(databaseOptions())
  context.subscriptions.push({ dispose: () => repository.close() })

  const sidebarProvider = new DigitalPetSidebarProvider(context.extensionUri, repository, repository, {
    hygieneService: createPartnerHygieneService(repository, DIGIMON_CATALOG, STAGE_GAUGE_THRESHOLDS),
    eggPettingService: createEggPettingService(repository, DIGIMON_CATALOG, STAGE_GAUGE_THRESHOLDS),
  })
  const refreshSidebar = (): void => {
    void sidebarProvider.refresh()
  }

  const databaseWatcher = createDatabaseChangeWatcher({
    ...databaseOptions(),
    onChange: () => {
      repository.reloadFromDisk()
      if (sidebarProvider.isPresentationInProgress() !== true) {
        refreshSidebar()
      }
    },
  })
  context.subscriptions.push({ dispose: () => databaseWatcher.dispose() })

  return {
    repository,
    sidebarProvider,
    readSettings,
    databaseOptions,
    refreshSidebar,
  }
}
