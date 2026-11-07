import { Pool } from 'pg'
import { checkAuth, setCorsHeaders } from '../_utils/auth.js'
import { generateRecoveryCode, hashRecoveryCode } from '../_utils/session.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    const code = generateRecoveryCode()
    const hash = hashRecoveryCode(code)
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('recovery_hash', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [hash]
    )
    res.json({ success: true, recoveryCode: code })
  } catch (_e) {
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
