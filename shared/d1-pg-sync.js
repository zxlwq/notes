import { runMigrations } from './migrate.js'

/** @typedef {import('./d1-pg-sync.d.ts').PgQueryable} PgQueryable */
/** @typedef {import('./d1-pg-sync.d.ts').D1PgSnapshot} D1PgSnapshot */

export function normalizePgTimestamp(value) {
  if (!value) return new Date().toISOString()
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(' ', 'T') + '+08:00'
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    return `${s}+08:00`
  }
  return s
}

/**
 * @param {PgQueryable} pool
 */
export async function ensurePgSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      tags TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_data (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await runMigrations(pool)
}

/**
 * 将 D1 快照同步至 PostgreSQL（D1 为源、PG 为目标）。
 * @param {PgQueryable} pool
 * @param {D1PgSnapshot} snapshot
 */
export async function syncD1SnapshotToPg(pool, snapshot) {
  const notes = snapshot.notes ?? []
  const settings = snapshot.settings ?? []
  const orderRows = snapshot.orderData ?? []

  await ensurePgSchema(pool)

  const noteIds = []
  for (const row of notes) {
    if (!row?.id) continue
    noteIds.push(row.id)
    await pool.query(
      `INSERT INTO notes (id, title, content, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         tags = EXCLUDED.tags,
         updated_at = EXCLUDED.updated_at`,
      [
        row.id,
        row.title ?? '',
        row.content ?? '',
        row.tags ?? '[]',
        normalizePgTimestamp(row.created_at),
        normalizePgTimestamp(row.updated_at),
      ]
    )
  }

  if (noteIds.length === 0) {
    await pool.query('DELETE FROM notes')
  } else {
    await pool.query('DELETE FROM notes WHERE NOT (id = ANY($1::text[]))', [noteIds])
  }

  for (const row of settings) {
    if (!row?.key) continue
    await pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at`,
      [row.key, row.value ?? '', normalizePgTimestamp(row.updated_at)]
    )
  }

  const orderKeys = []
  for (const row of orderRows) {
    if (!row?.key) continue
    orderKeys.push(row.key)
    await pool.query(
      `INSERT INTO order_data (key, value, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at`,
      [row.key, row.value ?? '[]', normalizePgTimestamp(row.updated_at)]
    )
  }

  if (orderKeys.length === 0) {
    await pool.query('DELETE FROM order_data')
  } else {
    await pool.query('DELETE FROM order_data WHERE NOT (key = ANY($1::text[]))', [orderKeys])
  }

  return {
    notes: noteIds.length,
    settings: settings.length,
    orderData: orderKeys.length,
  }
}
