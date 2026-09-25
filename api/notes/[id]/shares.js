import { checkAuth, setCorsHeaders } from '../../_utils/auth.js'
import { pool } from '../../_utils/pg.js'
import { ensureSharesTable, listSharesByNoteId } from '../../../shared/pg-shares.js'

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
    await ensureSharesTable(pool)
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing note ID' })
    }
    const items = await listSharesByNoteId(pool, id)
    return res.json({ items })
  } catch (e) {
    console.error('List shares error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
