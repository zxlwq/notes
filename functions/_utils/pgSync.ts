import { Pool } from '@neondatabase/serverless'
import { syncD1SnapshotToPg, upsertPgSettings } from '../../shared/d1-pg-sync.js'
import type { D1Database, PagesFunctionEnv } from '../types'

const PG_SYNC_MAX_RETRIES = 3
const PG_SYNC_RETRY_BASE_MS = 1000

/** Credential-related settings that must stay identical on D1 and PostgreSQL. */
const CREDENTIAL_SETTING_KEYS = [
  'password',
  'password_set',
  'password_version',
  'recovery_hash',
] as const

type SyncContext = {
  env: PagesFunctionEnv
  // eslint-disable-next-line no-unused-vars -- 类型签名参数名
  waitUntil?: (task: Promise<unknown>) => void
}

export function isPgSyncEnabled(env: PagesFunctionEnv): boolean {
  return typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.trim().length > 0
}

async function readD1Snapshot(db: D1Database) {
  const [notes, settings, orderData] = await Promise.all([
    db.prepare('SELECT id, title, content, tags, created_at, updated_at FROM notes').all(),
    db.prepare('SELECT key, value, updated_at FROM settings').all(),
    db.prepare('SELECT key, value, updated_at FROM order_data').all(),
  ])

  let noteSharesResults: Array<Record<string, string | null>> = []
  try {
    const noteShares = await db
      .prepare(
        'SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at FROM note_shares'
      )
      .all()
    noteSharesResults = (noteShares.results ?? []) as Array<Record<string, string | null>>
  } catch {
    // 迁移尚未创建 note_shares 时跳过，避免整次同步失败
    noteSharesResults = []
  }

  return {
    notes: (notes.results ?? []) as Array<Record<string, string | null>>,
    settings: (settings.results ?? []) as Array<Record<string, string | null>>,
    orderData: (orderData.results ?? []) as Array<Record<string, string | null>>,
    noteShares: noteSharesResults,
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function syncD1ToPostgres(env: PagesFunctionEnv) {
  if (!isPgSyncEnabled(env)) {
    return { skipped: true, reason: 'DATABASE_URL not configured' }
  }
  if (!env.NOTESD) {
    return { skipped: true, reason: 'D1 not bound' }
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= PG_SYNC_MAX_RETRIES; attempt++) {
    const pool = new Pool({ connectionString: env.DATABASE_URL as string })
    try {
      const snapshot = await readD1Snapshot(env.NOTESD)
      const counts = await syncD1SnapshotToPg(pool, snapshot)
      return { success: true, ...counts }
    } catch (err) {
      lastError = err
      if (attempt < PG_SYNC_MAX_RETRIES) {
        console.warn(`[pg-sync] attempt ${attempt} failed, retrying:`, err)
        await sleep(PG_SYNC_RETRY_BASE_MS * attempt)
      }
    } finally {
      await pool.end()
    }
  }

  throw lastError
}

/**
 * Immediately push password / recovery settings from D1 to PostgreSQL.
 * Prefer awaiting this after password changes so both DBs stay consistent.
 */
export async function syncCredentialsToPostgres(env: PagesFunctionEnv) {
  if (!isPgSyncEnabled(env)) {
    return { skipped: true as const, reason: 'DATABASE_URL not configured' }
  }
  if (!env.NOTESD) {
    return { skipped: true as const, reason: 'D1 not bound' }
  }

  const rows: Array<Record<string, string | null>> = []
  for (const key of CREDENTIAL_SETTING_KEYS) {
    const row = await env.NOTESD.prepare(
      `SELECT key, value, updated_at FROM settings WHERE key = ?`
    )
      .bind(key)
      .first<{ key: string; value: string; updated_at: string }>()
    if (row?.key) {
      rows.push({
        key: row.key,
        value: row.value ?? '',
        updated_at: row.updated_at ?? null,
      })
    }
  }

  if (rows.length === 0) {
    return { skipped: true as const, reason: 'no credential settings in D1' }
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL as string })
  try {
    const result = await upsertPgSettings(pool, rows)
    return { success: true as const, ...result }
  } finally {
    await pool.end()
  }
}

export function triggerPgSync(context: SyncContext) {
  if (!isPgSyncEnabled(context.env) || !context.env.NOTESD) return

  const task = syncD1ToPostgres(context.env).catch((err) => {
    console.error('[pg-sync] failed:', err)
  })

  if (context.waitUntil) {
    context.waitUntil(task)
  } else {
    void task
  }
}
