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
  {
    version: 3,
    name: 'note_shares_table',
    sql: `CREATE TABLE IF NOT EXISTS note_shares (
      token TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )`,
  },
  {
    version: 4,
    name: 'note_shares_note_id_index',
    sql: 'CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id)',
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
