import { checkAuth, setCorsHeaders } from '../_utils/auth.js'
import { pool } from '../_utils/pg.js'
import { getAiStatus } from '../../shared/ai/handlers.js'

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

  res.json(getAiStatus(process.env))
}
