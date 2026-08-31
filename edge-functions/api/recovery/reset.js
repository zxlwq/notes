import { neon } from '@neondatabase/serverless'
import { jsonResponse } from '../../_utils/auth.js'
import { hashRecoveryCode } from '../../_utils/session.js'
import { hashPassword, savePasswordHash } from '../../_utils/password.js'
import { incrementPasswordVersion } from '../../_utils/credentials.js'
import { createRateLimiter, getFetchRequestIp } from '../../_utils/rateLimit.js'

const resetRateLimit = createRateLimiter()

export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 204, request, env)
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request, env)
  }

  const limit = resetRateLimit(getFetchRequestIp(request))
  if (!limit.allowed) {
    return jsonResponse({ success: false, error: '请求过于频繁，请稍后再试' }, 429, request, env, {
      'Retry-After': String(limit.retryAfterSec),
    })
  }

  try {
    const { recoveryCode, newPassword } = await request.json()
    if (!recoveryCode || !newPassword) {
      return jsonResponse({ success: false, error: 'Missing parameters' }, 400, request, env)
    }

    const sql = neon(env.DATABASE_URL)
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    const rows = await sql`SELECT value FROM settings WHERE key = 'recovery_hash'`
    const storedHash = rows[0]?.value
    const hash = await hashRecoveryCode(recoveryCode)
    if (!storedHash || hash !== storedHash) {
      return jsonResponse({ success: false, error: 'Invalid recovery code' }, 401, request, env)
    }

    const passwordHash = await hashPassword(newPassword)
    await savePasswordHash(sql, passwordHash)
    await incrementPasswordVersion(sql)

    return jsonResponse({ success: true }, 200, request, env)
  } catch {
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, request, env)
  }
}
