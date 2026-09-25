import { neon } from '@neondatabase/serverless'
import { checkAuth, unauthorizedResponse } from '../../_utils/auth.js'
import { apiCors, apiPreflight } from '../../_utils/cors.js'
import { ensureSharesTable, getPublicShare, revokeShare } from '../../../shared/neon-shares.js'
import {
  createRateLimiter,
  getFetchRequestIp,
  rateLimitResponse,
} from '../../../shared/rateLimit.js'

const publicGetLimiter = createRateLimiter({ windowMs: 60_000, max: 60 })

export default async function onRequest(context) {
  const { request, env, params } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  const token = params?.token
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token required' }), {
      status: 400,
      headers: apiCors(request, env),
    })
  }

  try {
    const sql = neon(env.DATABASE_URL)
    await ensureSharesTable(sql)

    if (method === 'GET') {
      const limited = publicGetLimiter(getFetchRequestIp(request))
      if (!limited.allowed) {
        return rateLimitResponse(limited.retryAfterSec, apiCors(request, env))
      }
      const result = await getPublicShare(sql, token)
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error.error }), {
          status: result.error.status,
          headers: apiCors(request, env),
        })
      }
      return new Response(JSON.stringify(result.share), {
        status: 200,
        headers: apiCors(request, env),
      })
    }

    if (method === 'DELETE') {
      if (!(await checkAuth(request, env))) {
        return unauthorizedResponse(request, env)
      }
      const ok = await revokeShare(sql, token)
      if (!ok) {
        return new Response(JSON.stringify({ error: '分享不存在' }), {
          status: 404,
          headers: apiCors(request, env),
        })
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: apiCors(request, env),
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  } catch (e) {
    console.error('[SHARE] token API failed:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
