import { Pool } from 'pg'
import { verifySessionToken, extractSessionToken, getJwtSecret } from './_utils/session.js'
import { setCorsHeaders } from './_utils/auth.js'
import { getPasswordVersion } from '../shared/credentials.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

const PASSWORD = process.env.PASSWORD || ''

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const secret = getJwtSecret(PASSWORD)
  const pwdVer = await getPasswordVersion(pool)
  const token = extractSessionToken(req)
  const authenticated = Boolean(
    token && secret && verifySessionToken(token, secret, { expectedPwdVer: pwdVer })
  )
  res.json({ authenticated })
}
