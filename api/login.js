import { Pool } from 'pg'
import {
  signSessionToken,
  buildSessionCookie,
  getJwtSecret,
  getSessionTtlSec,
} from './_utils/session.js'
import { setCorsHeaders } from './_utils/auth.js'
import {
  verifyPassword,
  rehashLegacyPassword,
  matchesAdminPassword,
  isPasswordHash,
} from '../shared/password.js'
import { getPasswordVersion } from '../shared/credentials.js'
import { createRateLimiter, getRequestIp } from '../shared/rateLimit.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

const PASSWORD = process.env.PASSWORD || ''
const isProduction = process.env.NODE_ENV === 'production'
const loginRateLimit = createRateLimiter()

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {
    console.error('[vercel] Failed to initialize database:', e)
  }
}

async function getAdminPasswordRecord() {
  try {
    const [pwdRow, flagRow] = await Promise.all([
      pool.query('SELECT value FROM settings WHERE key = $1', ['password']),
      pool.query('SELECT value FROM settings WHERE key = $1', ['password_set']),
    ])
    const dbStored = pwdRow.rows[0]?.value || null
    return {
      dbStored,
      passwordSet: flagRow.rows[0]?.value === 'true' && Boolean(dbStored),
    }
  } catch {
    return { dbStored: null, passwordSet: false }
  }
}

async function appendLog(level, message, meta = null) {
  try {
    await pool.query('INSERT INTO logs (level, message, meta) VALUES ($1, $2, $3)', [
      level,
      message,
      meta ? JSON.stringify(meta) : null,
    ])
  } catch (e) {
    console.error('Failed to append log:', e)
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limit = loginRateLimit(getRequestIp(req))
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec))
    return res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试' })
  }

  try {
    await initDatabase()

    const { password } = req.body || {}

    const record = await getAdminPasswordRecord()
    if (!PASSWORD && !record.passwordSet) {
      return res.status(500).json({ success: false, error: 'PASSWORD not configured' })
    }

    if (isProduction && !process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, error: 'JWT_SECRET not configured' })
    }

    if (await matchesAdminPassword(password, PASSWORD, record.dbStored, record.passwordSet)) {
      const matchedDb =
        record.passwordSet && record.dbStored && (await verifyPassword(password, record.dbStored))
      if (matchedDb && record.dbStored && !isPasswordHash(record.dbStored)) {
        await rehashLegacyPassword(pool, password, record.dbStored)
      }
      const pwdVer = await getPasswordVersion(pool)
      const secret = getJwtSecret(PASSWORD)
      if (!secret) {
        return res.status(500).json({ success: false, error: 'JWT not configured' })
      }
      await appendLog(
        'info',
        '用户登录成功',
        `IP: ${req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'}`
      )
      const ttlSec = getSessionTtlSec()
      const token = signSessionToken(secret, { pwdVer, ttlSec })
      res.setHeader('Set-Cookie', buildSessionCookie(token, isProduction, ttlSec))
      const noteKey = String(process.env.NOTE_KEY || '').trim()
      return res.json({ success: true, token, ...(noteKey ? { noteKey } : {}) })
    }
    await appendLog(
      'warn',
      '用户登录失败',
      `IP: ${req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'}, 原因: 密码错误`
    )
    res.status(401).json({ success: false, error: 'Invalid password' })
  } catch (e) {
    console.error('[ERROR] Login failed:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
