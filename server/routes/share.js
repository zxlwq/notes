import { normalizeCreateShareBody } from '../../shared/shares.js'
import {
  ensureSharesTable,
  createShare,
  getPublicShare,
  revokeShare,
  listSharesByNoteId,
  revokeSharesByNoteId,
} from '../../shared/pg-shares.js'
import { createRateLimiter, getRequestIp } from '../../shared/rateLimit.js'

const publicGetLimiter = createRateLimiter({ windowMs: 60_000, max: 60 })

export function registerShareRoutes(app, ctx) {
  const { pool, authMiddleware, appendLog } = ctx

  app.post('/api/share', authMiddleware, async (req, res) => {
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
      res.json({
        success: true,
        token: share.token,
        urlPath: `/s/${share.token}`,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
      })
    } catch (e) {
      await appendLog('error', '创建分享失败', { error: String(e) })
      res.status(500).json({ success: false, error: '创建分享失败' })
    }
  })

  app.get('/api/share/:token', async (req, res) => {
    try {
      const limited = publicGetLimiter(getRequestIp(req))
      if (!limited.allowed) {
        res.setHeader('Retry-After', String(limited.retryAfterSec))
        return res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试' })
      }
      await ensureSharesTable(pool)
      const result = await getPublicShare(pool, req.params.token)
      if (result.error) {
        return res.status(result.error.status).json({ success: false, error: result.error.error })
      }
      res.json(result.share)
    } catch (e) {
      await appendLog('error', '获取分享失败', { error: String(e) })
      res.status(500).json({ success: false, error: '获取分享失败' })
    }
  })

  app.delete('/api/share/:token', authMiddleware, async (req, res) => {
    try {
      await ensureSharesTable(pool)
      const ok = await revokeShare(pool, req.params.token)
      if (!ok) {
        return res.status(404).json({ success: false, error: '分享不存在' })
      }
      res.json({ success: true })
    } catch (e) {
      await appendLog('error', '撤销分享失败', { error: String(e) })
      res.status(500).json({ success: false, error: '撤销分享失败' })
    }
  })

  app.get('/api/notes/:id/shares', authMiddleware, async (req, res) => {
    try {
      await ensureSharesTable(pool)
      const items = await listSharesByNoteId(pool, req.params.id)
      res.json({ items })
    } catch (e) {
      await appendLog('error', '列出分享失败', { error: String(e) })
      res.status(500).json({ success: false, error: '列出分享失败' })
    }
  })
}

export { revokeSharesByNoteId, ensureSharesTable }
