import { checkAuth, setCorsHeaders } from '../_utils/auth.js'
import { pool } from '../_utils/pg.js'
import { ensureSharesTable, getPublicShare, revokeShare } from '../../shared/pg-shares.js'
import { createRateLimiter, getRequestIp } from '../../shared/rateLimit.js'

const publicGetLimiter = createRateLimiter({ windowMs: 60_000, max: 60 })

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const token = req.query.token
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'Token required' })
  }

  try {
    await ensureSharesTable(pool)

    if (req.method === 'GET') {
      const limited = publicGetLimiter(getRequestIp(req))
      if (!limited.allowed) {
        res.setHeader('Retry-After', String(limited.retryAfterSec))
        return res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试' })
      }

      const result = await getPublicShare(pool, token)
      if (result.error) {
        return res.status(result.error.status).json({ success: false, error: result.error.error })
      }
      return res.json(result.share)
    }

    if (req.method === 'DELETE') {
      if (!(await checkAuth(req, pool))) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
      }
      const ok = await revokeShare(pool, token)
      if (!ok) {
        return res.status(404).json({ success: false, error: '分享不存在' })
      }
      return res.json({ success: true })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('Share token API error:', e)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
