import { checkAuth, setCorsHeaders } from '../_utils/auth.js'
import { pool } from '../_utils/pg.js'
import { ensureNotesTable, getNoteById, updateNote, deleteNote } from '../../shared/pg-notes.js'

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

    const { id } = req.query
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing note ID' })
    }

    if (req.method === 'GET') {
      const note = await getNoteById(pool, id)
      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' })
      }
      return res.json(note)
    }

    if (req.method === 'PUT') {
      const { title, content, tags } = req.body
      await updateNote(pool, id, { title, content, tags })
      return res.json({ success: true })
    }

    if (req.method === 'DELETE') {
      await deleteNote(pool, id)
      return res.json({ success: true })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('Notes API error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
