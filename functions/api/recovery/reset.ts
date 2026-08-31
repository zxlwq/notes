import { hashRecoveryCode } from '../../_utils/session'
import { hashPassword, savePasswordHash } from '../../_utils/password'
import { incrementPasswordVersion } from '../../_utils/credentials'
import { createRateLimiter, getFetchRequestIp } from '../../_utils/rateLimit'
import { triggerPgSync } from '../../_utils/pgSync'
import type { PagesFunction } from '../../types'
import { apiCors, apiPreflight } from '../../_utils/cors'

const resetRateLimit = createRateLimiter()

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'POST, OPTIONS'),
    })
  }

  const limit = resetRateLimit(getFetchRequestIp(request))
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
      status: 429,
      headers: apiCors(request, env, { 'Retry-After': String(limit.retryAfterSec) }),
    })
  }

  try {
    const { recoveryCode, newPassword } = await request.json()
    if (!recoveryCode || !newPassword) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: apiCors(request, env),
      })
    }

    if (!env.NOTESD) {
      return new Response(JSON.stringify({ error: 'Database not bound' }), {
        status: 500,
        headers: apiCors(request, env),
      })
    }

    await env.NOTESD.exec(
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`
    )
    const row = await env.NOTESD.prepare(
      `SELECT value FROM settings WHERE key = 'recovery_hash'`
    ).first<{ value: string }>()
    const hash = await hashRecoveryCode(recoveryCode)
    if (!row?.value || row.value !== hash) {
      return new Response(JSON.stringify({ error: 'Invalid recovery code' }), {
        status: 401,
        headers: apiCors(request, env),
      })
    }

    const passwordHash = await hashPassword(newPassword)
    await savePasswordHash(env.NOTESD, passwordHash)
    await incrementPasswordVersion(env)

    triggerPgSync(context)
    return Response.json({ success: true }, { headers: apiCors(request, env) })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
