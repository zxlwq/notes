import { Pool } from 'pg'
import { checkAuth, setCorsHeaders } from '../_utils/auth.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!(await checkAuth(req, pool))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['recovery_hash'])
    res.json({ configured: result.rows.length > 0 && Boolean(result.rows[0].value) })
  } catch (_e) {
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
