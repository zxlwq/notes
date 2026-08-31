import { safeJsonParse } from '../../shared/util.js'
import { importNotes as importNotesToDb, listNoteSummariesPage } from '../../shared/pg-notes.js'
import { parsePageLimit, buildNotesListResponse } from '../../shared/pagination.js'

export function registerNotesRoutes(app, ctx) {
  const { pool, authMiddleware, appendLog, getAllNotes } = ctx

  app.get('/api/notes', authMiddleware, async (req, res) => {
    try {
      if (req.query.page !== undefined || req.query.limit !== undefined) {
        const { page, limit } = parsePageLimit(req.query)
        const result = await listNoteSummariesPage(pool, page, limit)
        return res.json(
          buildNotesListResponse(result.items, result.total, result.page, result.limit)
        )
      }
      const notes = await getAllNotes()
      res.json(notes)
    } catch (e) {
      await appendLog('error', '获取笔记失败', { error: String(e) })
      res.status(500).json({ success: false, error: '加载笔记失败' })
    }
  })

  app.get('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
      const id = req.params.id
      const result = await pool.query('SELECT * FROM notes WHERE id = $1', [id])

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: '未找到' })
      }

      const row = result.rows[0]
      const note = {
        id: row.id,
        title: row.title || '',
        content: row.content || '',
        tags: safeJsonParse(row.tags, []),
        createdAt: row.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
      }

      res.json(note)
    } catch (e) {
      await appendLog('error', '获取笔记失败', { error: String(e) })
      res.status(500).json({ success: false, error: '加载笔记失败' })
    }
  })

  app.post('/api/notes', authMiddleware, async (req, res) => {
    try {
      const body = req.body || {}
      const id = body.id || String(Date.now())
      const note = {
        id,
        title: body.title || '',
        content: body.content || '',
        tags: Array.isArray(body.tags) ? body.tags : [],
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await pool.query(
        `INSERT INTO notes (id, title, content, tags, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         tags = EXCLUDED.tags,
         updated_at = EXCLUDED.updated_at`,
        [
          note.id,
          note.title,
          note.content,
          JSON.stringify(note.tags),
          note.createdAt,
          note.updatedAt,
        ]
      )

      await appendLog('info', '笔记已创建/更新', { id })
      res.json({ success: true, id })
    } catch (e) {
      await appendLog('error', '创建笔记失败', { error: String(e) })
      res.status(500).json({ success: false, error: '创建笔记失败' })
    }
  })

  app.put('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
      const id = req.params.id
      const body = req.body || {}

      const existing = await pool.query('SELECT * FROM notes WHERE id = $1', [id])
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: '笔记未找到' })
      }

      const oldNote = existing.rows[0]
      const note = {
        id,
        title: body.title ?? oldNote.title ?? '',
        content: body.content ?? oldNote.content ?? '',
        tags: Array.isArray(body.tags) ? body.tags : safeJsonParse(oldNote.tags, []),
        createdAt: oldNote.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await pool.query(
        'UPDATE notes SET title = $1, content = $2, tags = $3, updated_at = $4 WHERE id = $5',
        [note.title, note.content, JSON.stringify(note.tags), note.updatedAt, note.id]
      )

      await appendLog('info', '笔记已更新', { id })
      res.json({ success: true })
    } catch (e) {
      await appendLog('error', '更新笔记失败', { error: String(e) })
      res.status(500).json({ success: false, error: '更新笔记失败' })
    }
  })

  app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
      const id = req.params.id
      await pool.query('DELETE FROM notes WHERE id = $1', [id])
      await appendLog('info', '笔记已删除', { id })
      res.json({ success: true })
    } catch (e) {
      await appendLog('error', '删除笔记失败', { error: String(e) })
      res.status(500).json({ success: false, error: '删除笔记失败' })
    }
  })

  app.post('/api/import', authMiddleware, async (req, res) => {
    try {
      const list = Array.isArray(req.body) ? req.body : req.body?.notes || []
      const imported = await importNotesToDb(pool, list)

      await appendLog('info', '笔记已导入', { imported })
      res.json({ success: true, imported })
    } catch (e) {
      await appendLog('error', '导入失败', `错误: ${String(e)}`)
      res.status(500).json({ success: false, error: '导入失败' })
    }
  })
}
