import { Pool } from 'pg'
import { setCorsHeaders } from '../_utils/auth.js'
import { hashRecoveryCode } from '../_utils/session.js'
import { hashPassword, savePasswordHash } from '../../shared/password.js'
import { incrementPasswordVersion } from '../../shared/credentials.js'
import { createRateLimiter, getRequestIp } from '../../shared/rateLimit.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

const resetRateLimit = createRateLimiter()

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limit = resetRateLimit(getRequestIp(req))
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec))
    return res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试' })
  }

  try {
    const { recoveryCode, newPassword } = req.body || {}
    if (!recoveryCode || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing parameters' })
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['recovery_hash'])
    const storedHash = result.rows[0]?.value
    if (!storedHash || hashRecoveryCode(recoveryCode) !== storedHash) {
      return res.status(401).json({ success: false, error: 'Invalid recovery code' })
    }

    const hash = await hashPassword(newPassword)
    await savePasswordHash(pool, hash)
    await incrementPasswordVersion(pool)

    res.json({ success: true })
  } catch (_e) {
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
