import { clearSessionCookie } from './_utils/session.js'
import { setCorsHeaders } from './_utils/auth.js'

const isProduction = process.env.NODE_ENV === 'production'

export default function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  res.setHeader('Set-Cookie', clearSessionCookie(isProduction))
  res.json({ success: true })
}
