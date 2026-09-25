import { neon } from '@neondatabase/serverless'
import { checkAuth, jsonResponse } from '../../_utils/auth.js'
import { generateRecoveryCode, hashRecoveryCode } from '../../_utils/session.js'

export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 204, request, env)
  }

  if (request.method !== 'POST') {
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
    const code = generateRecoveryCode()
    const hash = await hashRecoveryCode(code)
    await sql`
      INSERT INTO settings (key, value, updated_at) VALUES ('recovery_hash', ${hash}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `
    return jsonResponse({ success: true, recoveryCode: code }, 200, request, env)
  } catch {
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, request, env)
  }
}
