import { Pool } from 'pg'
import { checkAuth, setCorsHeaders } from './_utils/auth.js'
import { hashPassword, savePasswordHash, matchesAdminPassword } from '../shared/password.js'
import { incrementPasswordVersion } from '../shared/credentials.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
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

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!(await checkAuth(req, pool))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    await initDatabase()
    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing password fields' })
    }

    const envPassword = process.env.PASSWORD || ''
    const record = await getAdminPasswordRecord()
    if (
      !(await matchesAdminPassword(
        currentPassword,
        envPassword,
        record.dbStored,
        record.passwordSet
      ))
    ) {
      return res.status(401).json({ success: false, error: 'Invalid current password' })
    }

    const hash = await hashPassword(newPassword)
    await savePasswordHash(pool, hash)
    await incrementPasswordVersion(pool)

    res.json({ success: true })
  } catch (e) {
    console.error('Change password error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
