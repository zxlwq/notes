import { checkAuth, setCorsHeaders } from '../_utils/auth.js'
import { pool } from '../_utils/pg.js'
import { logToPostgreSQL } from '../_utils/log.js'
import { getRequestIp } from '../../shared/rateLimit.js'
import { handleAiComplete } from '../../shared/ai/handlers.js'

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

  const ip = getRequestIp(req)
  const result = await handleAiComplete(process.env, req.body, ip, logToPostgreSQL)

  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value)
    }
  }

  res.status(result.status).json(result.body)
}
