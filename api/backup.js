import { Pool } from 'pg'
import axios from 'axios'
import { checkAuth, setCorsHeaders } from './_utils/auth.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

const WEBDAV_URL = process.env.WEBDAV_URL || ''
const WEBDAV_USER = process.env.WEBDAV_USER || ''
const WEBDAV_PASS = process.env.WEBDAV_PASS || ''

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_data (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.warn('[vercel] Database tables initialized')
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

async function getAllNotes() {
  const result = await pool.query('SELECT * FROM notes ORDER BY updated_at DESC')
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
  }))
}

async function uploadToWebDAV(content) {
  if (!WEBDAV_URL || !WEBDAV_USER || !WEBDAV_PASS) {
    throw new Error('WebDAV credentials not configured')
  }

  const url = `${WEBDAV_URL}/notes.md`
  const auth = Buffer.from(`${WEBDAV_USER}:${WEBDAV_PASS}`).toString('base64')

  await axios.put(url, content, {
    headers: {
      'Content-Type': 'text/markdown',
      Authorization: `Basic ${auth}`,
    },
  })
}

async function downloadFromWebDAV() {
  if (!WEBDAV_URL || !WEBDAV_USER || !WEBDAV_PASS) {
    throw new Error('WebDAV credentials not configured')
  }

  const url = `${WEBDAV_URL}/notes.md`
  const auth = Buffer.from(`${WEBDAV_USER}:${WEBDAV_PASS}`).toString('base64')

  const response = await axios.get(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })

  return response.data
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
      const notes = await getAllNotes()

      if (notes.length === 0) {
        return res.json({ success: false, error: '没有笔记可备份' })
      }

      let markdown = ''
      notes.forEach((note, index) => {
        markdown += `# ${note.title}\n`
        markdown += `标签: ${note.tags?.join(', ') || ''}\n`
        markdown += `创建时间: ${note.createdAt}\n`
        markdown += `更新时间: ${note.updatedAt}\n\n`
        markdown += `${note.content}\n\n`
        if (index < notes.length - 1) {
          markdown += '---\n\n'
        }
      })

      try {
        await uploadToWebDAV(markdown)
        await appendLog('info', '笔记已成功上传到云端', `文件: notes.md, 笔记数量: ${notes.length}`)
        return res.json({
          success: true,
          message: `笔记已成功上传到云端`,
          fileName: 'notes.md',
          totalNotes: notes.length,
        })
      } catch (e) {
        await appendLog('error', 'WebDAV 上传失败', e.message)
        return res.status(500).json({ success: false, error: `上传失败: ${e.message}` })
      }
    }

    if (req.method === 'GET') {
      try {
        const markdown = await downloadFromWebDAV()

        const notes = []
        const noteContents = markdown.split('\n\n---\n\n').filter((note) => note.trim())

        noteContents.forEach((noteContent, index) => {
          const trimmedContent = noteContent.trim()
          if (!trimmedContent) return

          const lines = trimmedContent.split('\n')

          let title = lines[0] || `导入笔记 ${index + 1}`
          if (title.startsWith('# ')) {
            title = title.slice(2)
          }

          let tags = []
          let createdAt = new Date().toISOString()
          let updatedAt = new Date().toISOString()
          let contentStartIndex = 1

          for (let j = 1; j < lines.length; j++) {
            const line = lines[j]
            if (line.startsWith('标签: ')) {
              const tagStr = line.slice(3).trim()
              tags = tagStr
                ? tagStr
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t)
                : []
            } else if (line.startsWith('创建时间: ')) {
              createdAt = line.slice(5).trim() || createdAt
            } else if (line.startsWith('更新时间: ')) {
              updatedAt = line.slice(5).trim() || updatedAt
            } else if (line === '') {
              contentStartIndex = j + 1
              break
            }
          }

          const noteContentText = lines.slice(contentStartIndex).join('\n')

          if (noteContentText.trim()) {
            notes.push({
              id: `imported-${Date.now()}-${index}`,
              title,
              content: noteContentText,
              tags,
              createdAt,
              updatedAt,
            })
          }
        })

        if (notes.length === 0) {
          return res.json({ success: false, error: '备份文件中没有找到有效的笔记' })
        }

        await pool.query('DELETE FROM notes')

        if (notes.length > 0) {
          const values = notes.map((note) => [
            note.id,
            note.title,
            note.content,
            JSON.stringify(note.tags),
            note.createdAt,
            note.updatedAt,
          ])

          const placeholders = values
            .map(
              (_, i) =>
                `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
            )
            .join(', ')

          const flatValues = values.flat()
          await pool.query(
            `INSERT INTO notes (id, title, content, tags, created_at, updated_at) VALUES ${placeholders}`,
            flatValues
          )
        }

        await appendLog(
          'info',
          '笔记已成功从云端下载并导入',
          `文件: notes.md, 导入: ${notes.length} 条`
        )
        return res.json({
          success: true,
          message: `笔记已成功从云端下载并导入`,
          fileName: 'notes.md',
          importedCount: notes.length,
          updatedCount: 0,
        })
      } catch (e) {
        await appendLog('error', 'WebDAV 下载失败', e.message)
        return res.status(500).json({ success: false, error: `下载失败: ${e.message}` })
      }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('Backup API error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
