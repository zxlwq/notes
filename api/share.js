import { checkAuth, setCorsHeaders } from './_utils/auth.js'
import { pool } from './_utils/pg.js'
import { ensureSharesTable, createShare } from '../shared/pg-shares.js'
import { normalizeCreateShareBody } from '../shared/shares.js'

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
    await ensureSharesTable(pool)
    const normalized = normalizeCreateShareBody(req.body || {})
    if (normalized.error) {
      return res.status(400).json({ success: false, error: normalized.error })
    }

    const share = await createShare(pool, {
      noteId: normalized.noteId,
      title: normalized.title,
      content: normalized.content,
      tagsJson: normalized.tagsJson,
      expiresAt: normalized.expiresAt,
    })

    return res.json({
      success: true,
      token: share.token,
      urlPath: `/s/${share.token}`,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    })
  } catch (e) {
    console.error('Share create error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
