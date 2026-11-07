import { formatNotesToMarkdown, parseMarkdownToNotes } from '../../shared/backup.js'
import { replaceAllNotes } from '../../shared/pg-notes.js'
import { getR2Config, uploadToR2, downloadFromR2 } from '../services/r2.js'

export function registerR2Routes(app, ctx) {
  const { pool, authMiddleware, appendLog, getAllNotesWithContent } = ctx

  app.post('/api/r2', authMiddleware, async (req, res) => {
    try {
      const notes = await getAllNotesWithContent()
      if (!notes || notes.length === 0) {
        await appendLog('warn', 'r2:post:no_notes')
        return res.json({ success: false, error: '没有可导出的笔记' })
      }

      const markdown = formatNotesToMarkdown(notes)

      const config = getR2Config()
      if (!config || !config.endpoint) {
        await appendLog('error', 'r2:post:no_config')
        return res.status(500).json({ success: false, error: 'R2 未配置' })
      }

      try {
        await uploadToR2(markdown)
        await appendLog('info', 'r2:post:success', { fileName: 'notes.md', count: notes.length })
        return res.json({
          success: true,
          message: '成功上传到R2',
          fileName: 'notes.md',
          totalNotes: notes.length,
        })
      } catch (e) {
        await appendLog('error', 'r2:post:failed', { error: String(e) })
        return res
          .status(500)
          .json({ success: false, error: `上传失败: ${e.message || String(e)}` })
      }
    } catch (e) {
      await appendLog('error', 'r2:post:exception', { error: String(e) })
      return res.status(500).json({ success: false, error: e.message || '上传失败' })
    }
  })

  app.get('/api/r2', authMiddleware, async (req, res) => {
    try {
      const config = getR2Config()
      if (!config || !config.endpoint) {
        await appendLog('error', 'r2:get:no_config')
        return res.status(500).json({ success: false, error: 'R2 未配置' })
      }

      const content = await downloadFromR2()
      const notes = parseMarkdownToNotes(content)
      if (!notes || notes.length === 0) {
        await appendLog('error', 'r2:get:no_notes')
        return res.status(400).json({ success: false, error: 'R2 文件中没有找到有效的笔记' })
      }

      const importedCount = await replaceAllNotes(pool, notes)

      await appendLog('info', 'r2:get:success', { importedCount })
      return res.json({
        success: true,
        message: '成功从R2导入',
        fileName: 'notes.md',
        importedCount,
        updatedCount: 0,
        totalNotes: notes.length,
      })
    } catch (e) {
      await appendLog('error', 'r2:get:failed', { error: String(e) })
      return res.status(500).json({ success: false, error: `下载失败: ${e.message || String(e)}` })
    }
  })
}
