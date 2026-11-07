import { Pool } from 'pg'
import { checkAuth, setCorsHeaders } from './_utils/auth.js'

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
    console.warn('[vercel] Logs table initialized')
  } catch (e) {
    console.error('[vercel] Failed to initialize logs table:', e)
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

    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 200')
      const logs = result.rows.map((row) => ({
        id: row.id,
        level: row.level,
        message: row.message,
        meta: row.meta,
        created_at: row.created_at?.toISOString() || new Date().toISOString(),
      }))

      return res.json({ items: logs })
    }

    if (req.method === 'DELETE') {
      await pool.query('DELETE FROM logs')
      return res.json({ success: true })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('Logs API error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
