import axios from 'axios'
import { formatNotesToMarkdown, parseMarkdownToNotes } from '../../shared/backup.js'

export function registerBackupRoutes(app, ctx) {
  const {
    pool,
    WEBDAV_URL,
    WEBDAV_USER,
    WEBDAV_PASS,
    authMiddleware,
    appendLog,
    getAllNotesWithContent,
  } = ctx

  app.post('/api/backup', authMiddleware, async (req, res) => {
    try {
      const notes = await getAllNotesWithContent()
      const fileName = 'notes.md'
      const content = formatNotesToMarkdown(notes)

      if (WEBDAV_URL) {
        const base = WEBDAV_URL.replace(/\/$/, '')
        const targetUrl = `${base}/${fileName}`
        await axios.put(targetUrl, content, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
          auth:
            WEBDAV_USER || WEBDAV_PASS
              ? { username: WEBDAV_USER, password: WEBDAV_PASS }
              : undefined,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        })
        await appendLog('info', '笔记已上传到云端', `上传数量: ${notes.length} 条笔记`)
        return res.json({ success: true, fileName, totalNotes: notes.length })
      }

      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
        ['backup_latest', content, new Date().toISOString()]
      )
      await appendLog('info', '笔记已保存到本地', `保存数量: ${notes.length} 条笔记`)
      res.json({ success: true, fileName, totalNotes: notes.length })
    } catch (e) {
      await appendLog('error', '备份失败', `错误: ${String(e)}`)
      res.status(500).json({ success: false, error: '备份失败' })
    }
  })

  app.get('/api/backup', authMiddleware, async (req, res) => {
    try {
      let markdown = ''

      if (WEBDAV_URL) {
        const base = WEBDAV_URL.replace(/\/$/, '')
        const targetUrl = `${base}/notes.md`
        const response = await axios.get(targetUrl, {
          responseType: 'text',
          auth:
            WEBDAV_USER || WEBDAV_PASS
              ? { username: WEBDAV_USER, password: WEBDAV_PASS }
              : undefined,
          validateStatus: (s) => s >= 200 && s < 300,
        })
        markdown = String(response.data || '')
      } else {
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', [
          'backup_latest',
        ])
        markdown = result.rows[0]?.value || ''
      }

      const parsedNotes = parseMarkdownToNotes(markdown)
      const importedCount = parsedNotes.length

      res.json({ success: true, fileName: 'notes.md', importedCount, updatedCount: 0 })
      ;(async () => {
        try {
          await pool.query('DELETE FROM notes')
          await appendLog('info', 'cleared old notes from postgres', { count: 0 })

          for (const item of parsedNotes) {
            await pool.query(
              'INSERT INTO notes (id, title, content, tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
              [
                item.id,
                item.title,
                item.content,
                JSON.stringify(item.tags),
                item.createdAt,
                item.updatedAt,
              ]
            )
          }

          await appendLog('info', '笔记已从云端下载并导入', { importedCount })
        } catch (err) {
          console.error('后台导入错误:', err)
          await appendLog('error', '后台导入失败', `错误: ${String(err)}`)
        }
      })()
    } catch (e) {
      await appendLog('error', '下载失败', `错误: ${String(e)}`)
      res.status(500).json({ success: false, error: '下载失败' })
    }
  })
}
