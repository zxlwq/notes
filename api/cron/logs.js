import { Pool } from 'pg'
import { pruneOldLogs, LOG_RETENTION_DAYS } from '../../shared/logRet.js'
import { runMigrations } from '../../shared/migrate.js'
import { ensureSharesTable, revokeExpiredShares } from '../../shared/pg-shares.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

/** Vercel Cron：每日清理 PostgreSQL 旧日志，并撤销过期分享 */
export default async function handler(req, res) {
  const cronSecret = process.env.TOKEN
  if (cronSecret) {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
  }

  try {
    await runMigrations(pool)
    await ensureSharesTable(pool)
    const [deleted, revokedShares] = await Promise.all([
      pruneOldLogs(pool, LOG_RETENTION_DAYS),
      revokeExpiredShares(pool),
    ])
    return res.status(200).json({
      success: true,
      deleted,
      revokedShares,
      retentionDays: LOG_RETENTION_DAYS,
    })
  } catch (e) {
    console.error('[cron/logs]', e)
    return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
  }
}
