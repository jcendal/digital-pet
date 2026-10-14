import type { SqliteExecutor } from "../../ports/sqlite-executor.ts"

type SqliteMigrationExecutor = Pick<SqliteExecutor, "run" | "all" | "transaction">

type Migration = {
  readonly version: number
  readonly sql: readonly string[]
}

const MIGRATIONS = [
  {
    version: 1,
    sql: [
      `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS trainer_state (
          trainer_id INTEGER PRIMARY KEY CHECK (trainer_id = 1),
          total_tokens INTEGER NOT NULL
        )
      `,
      `
        INSERT INTO trainer_state (trainer_id, total_tokens)
        VALUES (1, 0)
        ON CONFLICT (trainer_id) DO NOTHING
      `,
      `
        CREATE TABLE IF NOT EXISTS partners (
          partner_id TEXT PRIMARY KEY,
          generation INTEGER NOT NULL,
          current_node_id TEXT NOT NULL,
          gauge INTEGER NOT NULL,
          is_terminal INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          retired_at TEXT
        )
      `,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS partners_one_active_partner
        ON partners ((1))
        WHERE retired_at IS NULL
      `,
      `
        CREATE TABLE IF NOT EXISTS partner_events (
          event_id TEXT PRIMARY KEY,
          partner_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          current_node_id TEXT NOT NULL,
          gauge INTEGER NOT NULL,
          is_terminal INTEGER NOT NULL,
          token_delta INTEGER,
          receipt_key TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (partner_id) REFERENCES partners (partner_id)
        )
      `,
      `
        CREATE INDEX IF NOT EXISTS partner_events_partner_created_at
        ON partner_events (partner_id, created_at, event_id)
      `,
      `
        CREATE TABLE IF NOT EXISTS usage_receipts (
          receipt_key TEXT PRIMARY KEY,
          partner_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          token_delta INTEGER NOT NULL,
          cost REAL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (partner_id) REFERENCES partners (partner_id),
          FOREIGN KEY (event_id) REFERENCES partner_events (event_id)
        )
      `,
    ],
  },
  {
    version: 2,
    sql: ["CREATE UNIQUE INDEX IF NOT EXISTS partners_generation_unique ON partners (generation)"],
  },
  {
    version: 3,
    sql: [
      `
        CREATE TABLE IF NOT EXISTS vpet_control_state (
          control_id INTEGER PRIMARY KEY CHECK (control_id = 1),
          frozen INTEGER NOT NULL CHECK (frozen IN (0, 1)),
          cheat_node_id TEXT
        )
      `,
      `
        INSERT INTO vpet_control_state (control_id, frozen, cheat_node_id)
        VALUES (1, 0, NULL)
        ON CONFLICT (control_id) DO NOTHING
      `,
      `
        CREATE TABLE IF NOT EXISTS vpet_control_receipts (
          receipt_key TEXT PRIMARY KEY,
          mode TEXT NOT NULL CHECK (mode IN ('frozen', 'cheat')),
          token_delta INTEGER NOT NULL,
          cost REAL,
          created_at TEXT NOT NULL
        )
      `,
    ],
  },
  {
    version: 4,
    sql: [
      "ALTER TABLE partners ADD COLUMN pending_evolution_target_id TEXT",
      "ALTER TABLE partners ADD COLUMN battle_opponent_node_id TEXT",
    ],
  },
  {
    version: 5,
    sql: [
      "CREATE TABLE IF NOT EXISTS partner_hygiene (partner_id TEXT PRIMARY KEY REFERENCES partners(partner_id), state TEXT NOT NULL)",
    ],
  },
  {
    version: 6,
    sql: [
      "CREATE TABLE IF NOT EXISTS partner_adventures (partner_id TEXT PRIMARY KEY REFERENCES partners(partner_id), state TEXT NOT NULL)",
    ],
  },
  {
    version: 7,
    sql: [
      "CREATE TABLE IF NOT EXISTS adventure_schedule (schedule_id INTEGER PRIMARY KEY CHECK (schedule_id = 1), ready_at INTEGER NOT NULL)",
    ],
  },
  {
    version: 8,
    sql: [
      "CREATE TABLE IF NOT EXISTS boss_victories (region_id TEXT NOT NULL, node_id TEXT NOT NULL, defeated_at TEXT NOT NULL, PRIMARY KEY (region_id, node_id))",
    ],
  },
  {
    version: 9,
    sql: [
      `CREATE TABLE partner_team (
        team_id INTEGER PRIMARY KEY CHECK (team_id = 1),
        principal_id TEXT REFERENCES partners(partner_id),
        reserve_id TEXT REFERENCES partners(partner_id),
        reserve_paused_at INTEGER,
        revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
        CHECK (reserve_id IS NULL OR (principal_id IS NOT NULL AND reserve_id <> principal_id)),
        CHECK ((reserve_id IS NULL AND reserve_paused_at IS NULL) OR
          (reserve_id IS NOT NULL AND reserve_paused_at IS NOT NULL AND reserve_paused_at >= 0))
      )`,
      `INSERT INTO partner_team (team_id, principal_id, reserve_id, reserve_paused_at, revision)
        VALUES (1, (SELECT partner_id FROM partners WHERE retired_at IS NULL LIMIT 1), NULL, NULL, 0)`,
      "DROP INDEX partners_one_active_partner",
      `CREATE TRIGGER partners_limit_owned_insert BEFORE INSERT ON partners
        WHEN NEW.retired_at IS NULL AND (SELECT COUNT(*) FROM partners WHERE retired_at IS NULL) >= 2
        BEGIN SELECT RAISE(ABORT, 'A team can own at most two partners'); END`,
      `CREATE TRIGGER partners_limit_owned_restore BEFORE UPDATE OF retired_at ON partners
        WHEN OLD.retired_at IS NOT NULL AND NEW.retired_at IS NULL
          AND (SELECT COUNT(*) FROM partners WHERE retired_at IS NULL) >= 2
        BEGIN SELECT RAISE(ABORT, 'A team can own at most two partners'); END`,
    ],
  },
  {
    version: 10,
    sql: [
      `CREATE TABLE partner_combat_progress (
      partner_id TEXT PRIMARY KEY REFERENCES partners(partner_id),
      node_id TEXT NOT NULL,
      victories INTEGER NOT NULL DEFAULT 0 CHECK (victories BETWEEN 0 AND 1000000),
      battle_id TEXT
    )`,
    ],
  },
] as const satisfies readonly Migration[]

type MigrationRow = {
  readonly version: number
}

export const runMigrations = (database: SqliteMigrationExecutor): readonly number[] => {
  return database.transaction(() => {
    database.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `)

    const appliedVersions = new Set(
      database
        .all<MigrationRow>("SELECT version FROM schema_migrations ORDER BY version ASC")
        .map((row) => row.version),
    )

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) {
        continue
      }

      for (const statement of migration.sql) {
        database.run(statement)
      }
      database.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
        migration.version,
        new Date().toISOString(),
      ])
      appliedVersions.add(migration.version)
    }

    return [...appliedVersions].sort((left, right) => left - right)
  })
}
