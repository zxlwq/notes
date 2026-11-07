import { checkAuth, setCorsHeaders } from './_utils/auth.js'
import { pool } from './_utils/pg.js'
import {
  ensureNotesTable,
  listNoteSummaries,
  listNoteSummariesPage,
  upsertNote,
} from '../shared/pg-notes.js'
import { parsePageLimit, buildNotesListResponse } from '../shared/pagination.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!(await checkAuth(req, pool))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    await ensureNotesTable(pool)

    if (req.method === 'GET') {
      if (req.query?.page !== undefined || req.query?.limit !== undefined) {
        const { page, limit } = parsePageLimit(req.query)
        const result = await listNoteSummariesPage(pool, page, limit)
        return res.json(
          buildNotesListResponse(result.items, result.total, result.page, result.limit)
        )
      }
      const notes = await listNoteSummaries(pool)
      return res.json(notes)
    }

    if (req.method === 'POST') {
      const { id, title, content, tags, createdAt } = req.body
      if (!id || !title || !content) {
        return res.status(400).json({ success: false, error: 'Missing required fields' })
      }

      const noteId = await upsertNote(pool, {
        id,
        title,
        content,
        tags,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      return res.json({ success: true, id: noteId })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('Notes API error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
