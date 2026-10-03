import { checkAuth, setCorsHeaders } from './_utils/auth.js'
import { pool } from './_utils/pg.js'
import { ensureNotesTable, importNotes } from '../shared/pg-notes.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!(await checkAuth(req, pool))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    await ensureNotesTable(pool)
    const { notes } = req.body
    if (!Array.isArray(notes)) {
      return res.status(400).json({ success: false, error: 'Invalid notes format' })
    }

    const imported = await importNotes(pool, notes)
    return res.json({ success: true, imported })
  } catch (e) {
    console.error('Import error:', e)
    return res.status(500).json({ success: false, error: 'Import failed' })
  }
}
