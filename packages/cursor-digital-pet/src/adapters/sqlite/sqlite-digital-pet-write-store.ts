import { createSqliteAdventureStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-adventure-store.ts"
import type { SqliteDigitalPetWriteStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-types.ts"
import { createSqliteDigitalPetWriteStore } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-write-store.ts"
import { createSqliteEggPetting } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-egg-petting.ts"
import { createSqlitePartnerHygiene } from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-partner-hygiene.ts"
import type { AdventureStore } from "@jcendal/digital-pet-core/application/ports/adventure-store.ts"
import type { EggPettingStore } from "@jcendal/digital-pet-core/application/ports/egg-petting.ts"
import type { PartnerHygieneStore } from "@jcendal/digital-pet-core/application/ports/partner-hygiene.ts"
import type { SidebarSnapshotReader } from "@jcendal/digital-pet-core/application/ports/sidebar-snapshot.ts"
import { DEFAULT_WORLD_VISIT } from "@jcendal/digital-pet-fields/application/world.ts"

import { resolveDatabasePath, type SqliteDatabaseOptions } from "./options.ts"
import { openWritableSqliteDatabase } from "./sqlite-driver.ts"
import { readSidebarSnapshotFromExecutor } from "./sqlite-sidebar-snapshot-reader.ts"

export type CreateSqliteDigitalPetRepositoryOptions = SqliteDatabaseOptions

export type { HostPathOptions } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
export { resolveHostDatabasePath } from "@jcendal/digital-pet-core/adapters/sqlite/app-data-path.ts"
export type {
  PersistedPartnerEvent,
  SqliteDigitalPetWriteStore,
} from "@jcendal/digital-pet-core/adapters/sqlite/sqlite-digital-pet-types.ts"
export { resolveDatabasePath } from "./options.ts"

export type CursorSqliteDigitalPetRepository = SqliteDigitalPetWriteStore &
  AdventureStore &
  EggPettingStore &
  PartnerHygieneStore &
  SidebarSnapshotReader & {
    reloadFromDisk(): void
  }

export const createSqliteDigitalPetRepository = async (
  options: CreateSqliteDigitalPetRepositoryOptions = {},
): Promise<CursorSqliteDigitalPetRepository> => {
  const databasePath = resolveDatabasePath(options)
  const database = openWritableSqliteDatabase(databasePath)

  const writeStore = createSqliteDigitalPetWriteStore({
    databasePath,
    executor: database.executor,
    close: () => {
      database.close()
    },
  })

  return {
    ...writeStore,
    ...createSqliteAdventureStore(database.executor, DEFAULT_WORLD_VISIT.regionId),
    ...createSqliteEggPetting(database.executor),
    ...createSqlitePartnerHygiene(database.executor),
    getSidebarSnapshot: () => readSidebarSnapshotFromExecutor(database.executor),
    reloadFromDisk: () => {
      database.reloadFromDisk()
    },
  }
}
