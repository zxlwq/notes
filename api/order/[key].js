import { Pool } from 'pg'
import { checkAuth, setCorsHeaders } from '../_utils/auth.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

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
      CREATE TABLE IF NOT EXISTS order_data (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.warn('[vercel] Order table initialized')
  } catch (e) {
    console.error('[vercel] Failed to initialize order table:', e)
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

  if (!(await checkAuth(req, pool))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    await initDatabase()

    const key = req.query.key

    if (req.method === 'GET') {
      const result = await pool.query('SELECT value FROM order_data WHERE key = $1', [key])

      if (result.rows.length === 0) {
        return res.json({ success: true, data: null })
      }

      const value = result.rows[0].value
      let parsed = null
      try {
        parsed = value ? JSON.parse(value) : null
      } catch {
        parsed = value
      }

      return res.json({ success: true, data: parsed })
    }

    if (req.method === 'POST') {
      const value = req.body

      if (typeof value === 'undefined') {
        return res.status(400).json({ success: false, error: 'Value is required' })
      }

      const valueStr = JSON.stringify(value)

      await pool.query(
        'INSERT INTO order_data (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
        [key, valueStr, new Date().toISOString()]
      )

      await appendLog('info', `Order data saved: ${key}`, { key })
      return res.json({ success: true })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('Order API error:', e)
    await appendLog('error', 'Failed to process order API', { error: String(e) })
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
