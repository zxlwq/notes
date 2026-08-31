import { Pool } from 'pg'
import { pruneOldLogs, LOG_RETENTION_DAYS } from '../../shared/logRet.js'
import { runMigrations } from '../../shared/migrate.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

/** Vercel Cron：每日清理 PostgreSQL 旧日志 */
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
    const deleted = await pruneOldLogs(pool, LOG_RETENTION_DAYS)
    return res.status(200).json({ success: true, deleted, retentionDays: LOG_RETENTION_DAYS })
  } catch (e) {
    console.error('[cron/logs]', e)
    return res.status(500).json({ success: false, error: e?.message || 'Internal error' })
  }
}
