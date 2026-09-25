import { Pool } from 'pg'
import { checkAuth, setCorsHeaders } from '../_utils/auth.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

const PASSWORD = process.env.PASSWORD || ''

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.warn('[vercel] Settings table initialized')
  } catch (e) {
    console.error('[vercel] Failed to initialize settings table:', e)
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!(await checkAuth(req, pool))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    await initDatabase()

    const hasEnvPassword = Boolean(PASSWORD)

    const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['password'])
    const hasDbPassword = result.rows.length > 0 && result.rows[0].value

    return res.json({
      success: true,
      usingD1: false,
      usingPostgreSQL: true,
      hasEnvPassword,
      hasDbPassword,
      passwordSource: hasEnvPassword ? 'env' : hasDbPassword ? 'postgresql' : 'none',
    })
  } catch (e) {
    console.error('Password status API error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
