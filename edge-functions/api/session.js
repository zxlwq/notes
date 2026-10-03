import { neon } from '@neondatabase/serverless'
import { extractAndVerifySession } from '../_utils/session.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'
import { getPasswordVersion } from '../_utils/credentials.js'

export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: apiPreflight(request, env, 'GET, OPTIONS') })
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  }

  const password = env.PASSWORD || ''
  const isProduction = env.NODE_ENV === 'production'
  const sql = neon(env.DATABASE_URL)
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  const pwdVer = await getPasswordVersion(sql)
  const authenticated = await extractAndVerifySession(
    request,
    password,
    env.JWT_SECRET,
    pwdVer,
    isProduction
  )
  return new Response(JSON.stringify({ authenticated }), {
    status: 200,
    headers: apiCors(request, env),
  })
}
