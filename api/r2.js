import { checkAuth, setCorsHeaders } from './_utils/auth.js'
import { pool } from './_utils/pg.js'
import { ensureNotesTable } from '../shared/pg-notes.js'
import { importNotesFromR2, uploadNotesToR2 } from './_services/r2.js'

async function initDatabase() {
  try {
    await ensureNotesTable(pool)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {
    console.error('[vercel] Failed to initialize database:', e)
  }
}

async function appendLog(level, message, meta = null) {
  try {
    await pool.query('INSERT INTO logs (level, message, meta) VALUES ($1, $2, $3)', [
      level,
      message,
      meta ? JSON.stringify(meta) : null,
    ])
  } catch (e) {
    console.error('Failed to append log:', e)
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!(await checkAuth(req, pool))) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    await initDatabase()

    if (req.method === 'POST') {
      const result = await uploadNotesToR2()
      if (!result.ok) {
        await appendLog('error', 'r2:post:failed', { error: result.error })
        return res.status(result.status).json({ success: false, error: result.error })
      }

      await appendLog('info', 'r2:post:success', { count: result.totalNotes })
      return res.json({
        success: true,
        message: '成功上传到R2',
        fileName: 'notes.md',
        totalNotes: result.totalNotes,
      })
    }

    if (req.method === 'GET') {
      const result = await importNotesFromR2()
      if (!result.ok) {
        await appendLog('error', 'r2:get:failed', { error: result.error })
        return res.status(result.status).json({ success: false, error: result.error })
      }

      await appendLog('info', 'r2:get:success', { importedCount: result.importedCount })
      return res.json({
        success: true,
        message: '成功从R2导入',
        fileName: 'notes.md',
        importedCount: result.importedCount,
        updatedCount: 0,
      })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('R2 API error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
