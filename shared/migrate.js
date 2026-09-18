const MIGRATIONS = [
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

export async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  for (const migration of MIGRATIONS) {
    const existing = await pool.query('SELECT version FROM schema_migrations WHERE version = $1', [
      migration.version,
    ])
    if (existing.rows.length > 0) continue

    await pool.query(migration.sql)
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version])
  }
}
