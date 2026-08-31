import { neon } from '@neondatabase/serverless'
import { checkAuth, jsonResponse } from '../../_utils/auth.js'

export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 204, request, env)
  }

  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request, env)
  }

  if (!(await checkAuth(request, env))) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request, env)
  }

  try {
    const sql = neon(env.DATABASE_URL)
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    const rows = await sql`SELECT value FROM settings WHERE key = 'recovery_hash'`
    const configured = rows.length > 0 && Boolean(rows[0]?.value)
    return jsonResponse({ configured }, 200, request, env)
  } catch {
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, request, env)
  }
}
