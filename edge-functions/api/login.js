import { neon } from '@neondatabase/serverless'
import { signSessionToken, buildSessionCookie } from '../_utils/session.js'
import { jsonResponse } from '../_utils/auth.js'
import { apiPreflight } from '../_utils/cors.js'
import { getEffectivePassword, getPasswordVersion } from '../_utils/credentials.js'
import { verifyPassword, rehashLegacyPassword } from '../_utils/password.js'
import { createRateLimiter, getFetchRequestIp } from '../_utils/rateLimit.js'
import { logError } from '../_utils/log.js'

const loginRateLimit = createRateLimiter()

export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: apiPreflight(request, env) })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request, env)
  }

  const limit = loginRateLimit(getFetchRequestIp(request))
  if (!limit.allowed) {
    return jsonResponse({ success: false, error: '请求过于频繁，请稍后再试' }, 429, request, env, {
      'Retry-After': String(limit.retryAfterSec),
    })
  }

  try {
    const { password } = await request.json()
    const envPassword = env.PASSWORD || ''
    const isProduction = env.NODE_ENV === 'production'

    if (!envPassword) {
      return jsonResponse({ success: false, error: 'PASSWORD not configured' }, 500, request, env)
    }

    if (isProduction && !env.JWT_SECRET) {
      return jsonResponse({ success: false, error: 'JWT_SECRET not configured' }, 500, request, env)
    }

    const sql = neon(env.DATABASE_URL)

    await sql`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    const storedCredential = await getEffectivePassword(sql, envPassword)

    if (await verifyPassword(password, storedCredential)) {
      await rehashLegacyPassword(sql, password, storedCredential)
      const pwdVer = await getPasswordVersion(sql)

      try {
        await sql`INSERT INTO logs (level, message, meta) VALUES ('info', '用户登录成功', 'Edge login')`
      } catch (dbError) {
        logError('login:log:error', { message: dbError?.message }, env)
      }

      const token = await signSessionToken(
        envPassword,
        env.JWT_SECRET,
        { pwdVer },
        isProduction,
        env
      )
      return jsonResponse({ success: true, token }, 200, request, env, {
        'Set-Cookie': buildSessionCookie(token, isProduction, env),
      })
    }

    try {
      await sql`INSERT INTO logs (level, message, meta) VALUES ('warn', '用户登录失败', 'Edge login')`
    } catch (dbError) {
      logError('login:log:error', { message: dbError?.message }, env)
    }

    return jsonResponse({ success: false, error: 'Invalid password' }, 401, request, env)
  } catch (error) {
    logError('login:unhandled', { message: error?.message }, env)
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, request, env)
  }
}
