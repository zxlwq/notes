import { formatNotesToMarkdown, parseMarkdownToNotes } from '../../shared/backup.js'
import { replaceAllNotes } from '../../shared/pg-notes.js'
import { createOrUpdateGist, getGist } from '../services/gist.js'

export function registerGistRoutes(app, ctx) {
  const { pool, GIT_TOKEN, authMiddleware, appendLog, getAllNotesWithContent } = ctx

  app.post('/api/gist', authMiddleware, async (req, res) => {
    try {
      const notes = await getAllNotesWithContent()

      if (!notes || notes.length === 0) {
        await appendLog('warn', 'gist:post:no_notes', {})
        return res.json({ success: false, error: '没有可导出的笔记' })
      }

      const markdown = formatNotesToMarkdown(notes)

      if (!GIT_TOKEN) {
        await appendLog('error', 'gist:post:no_token')
        return res.status(500).json({ success: false, error: 'GitHub Token 未配置' })
      }

      try {
        const gistData = await createOrUpdateGist(markdown)
        await appendLog('info', 'gist:post:success', { gistId: gistData.id, count: notes.length })
        return res.json({
          success: true,
          message: '成功上传到Gist',
          fileName: 'notes.md',
          totalNotes: notes.length,
          gistId: gistData.id,
        })
      } catch (e) {
        await appendLog('error', 'gist:post:failed', { error: String(e) })
        return res
          .status(500)
          .json({ success: false, error: `上传失败: ${e.message || String(e)}` })
      }
    } catch (e) {
      await appendLog('error', 'gist:post:exception', { error: String(e) })
      return res.status(500).json({ success: false, error: e.message || '上传失败' })
    }
  })

  app.get('/api/gist', authMiddleware, async (req, res) => {
    try {
      if (!GIT_TOKEN) {
        await appendLog('error', 'gist:get:no_token')
        return res.status(500).json({ success: false, error: 'GitHub Token 未配置' })
      }

      const gistData = await getGist()
      const file = gistData.files['notes.md'] || Object.values(gistData.files)[0]

      if (!file || !file.content) {
        await appendLog('error', 'gist:get:no_content')
        return res.status(400).json({ success: false, error: 'Gist 中没有找到笔记内容' })
      }

      const notes = parseMarkdownToNotes(file.content)
      if (!notes || notes.length === 0) {
        await appendLog('error', 'gist:get:no_notes')
        return res.status(400).json({ success: false, error: '备份文件中没有找到有效的笔记' })
      }

      const importedCount = await replaceAllNotes(pool, notes)

      await appendLog('info', 'gist:get:success', { importedCount })
      return res.json({
        success: true,
        message: '成功从Gist导入',
        fileName: 'notes.md',
        importedCount,
        updatedCount: 0,
        totalNotes: notes.length,
      })
    } catch (e) {
      await appendLog('error', 'gist:get:failed', { error: String(e) })
      return res.status(500).json({ success: false, error: `下载失败: ${e.message || String(e)}` })
    }
  })
}
