import { checkAuth } from '../../_utils/auth'
import { triggerPgSync } from '../../_utils/pgSync'
import type { PagesFunction } from '../../types'
import { ensureSharesTable, getPublicShare, revokeShare } from '../../../shared/d1-shares.js'
import {
  createRateLimiter,
  getFetchRequestIp,
  rateLimitResponse,
} from '../../../shared/rateLimit.js'
import { apiCors, apiPreflight } from '../../_utils/cors'

const publicGetLimiter = createRateLimiter({ windowMs: 60_000, max: 60 })

const extractToken = (request: Request): string | null => {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean)
  // /api/share/:token
  return parts.length >= 3 && parts[0] === 'api' && parts[1] === 'share' ? parts[2] : null
}

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  const token = extractToken(request)
  if (!token) {
    return Response.json(
      { error: 'Token required' },
      { status: 400, headers: apiCors(request, env) }
    )
  }

  try {
    await ensureSharesTable(env.NOTESD!)

    if (method === 'GET') {
      const ip = getFetchRequestIp(request)
      const limited = publicGetLimiter(ip)
      if (!limited.allowed) {
        return rateLimitResponse(limited.retryAfterSec, apiCors(request, env))
      }

      const result = await getPublicShare(env.NOTESD!, token)
      if (result.error) {
        return Response.json(
          { error: result.error.error },
          { status: result.error.status, headers: apiCors(request, env) }
        )
      }
      return Response.json(result.share, { headers: apiCors(request, env) })
    }

    if (method === 'DELETE') {
      if (!(await checkAuth(request, env))) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401, headers: apiCors(request, env) }
        )
      }
      const ok = await revokeShare(env.NOTESD!, token)
      if (!ok) {
        return Response.json(
          { error: '分享不存在' },
          { status: 404, headers: apiCors(request, env) }
        )
      }
      triggerPgSync(context)
      return Response.json({ success: true }, { headers: apiCors(request, env) })
    }

    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: apiCors(request, env) }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500, headers: apiCors(request, env) })
  }
}
