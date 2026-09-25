import { neon } from '@neondatabase/serverless'
import { extractAndVerifySession } from './session.js'
import { apiCors } from './cors.js'
import { getPasswordVersion } from './credentials.js'

export async function checkAuth(request, env) {
  const envPassword = env.PASSWORD || ''
  if (!envPassword || !env.DATABASE_URL) return false

  const sql = neon(env.DATABASE_URL)
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  const pwdVer = await getPasswordVersion(sql)
  const isProduction = env.NODE_ENV === 'production'
  return extractAndVerifySession(request, envPassword, env.JWT_SECRET, pwdVer, isProduction)
}

export function jsonResponse(data, status, request, env, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...apiCors(request, env), ...extraHeaders },
  })
}

export function unauthorizedResponse(request, env) {
  return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request, env)
}

export { getEffectivePassword } from './credentials.js'
