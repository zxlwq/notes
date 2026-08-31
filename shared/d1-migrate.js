import { D1_NOW } from './d1-sql.js'

/** D1 索引迁移（与 shared/migrate.js 对齐） */
export const D1_MIGRATIONS = [
  {
    version: 1,
    name: 'notes_updated_at_index',
    sql: 'CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)',
  },
  {
    version: 2,
    name: 'logs_created_at_index',
    sql: 'CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC)',
  },
]

/** 供 README / 手动执行的索引 SQL */
export const D1_INDEX_SQL = D1_MIGRATIONS.map((m) => m.sql)

export async function runD1Migrations(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (${D1_NOW})
      )`
    )
    .run()

  for (const migration of D1_MIGRATIONS) {
    const existing = await db
      .prepare('SELECT version FROM schema_migrations WHERE version = ?')
      .bind(migration.version)
      .first()
    if (existing) continue

    await db.prepare(migration.sql).run()
    await db
      .prepare('INSERT INTO schema_migrations (version) VALUES (?)')
      .bind(migration.version)
      .run()
  }
}
