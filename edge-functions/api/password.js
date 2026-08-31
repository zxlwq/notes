import { neon } from '@neondatabase/serverless'
import { checkAuth, jsonResponse } from '../_utils/auth.js'
import { getEffectivePassword, incrementPasswordVersion } from '../_utils/credentials.js'
import { verifyPassword, hashPassword, savePasswordHash } from '../_utils/password.js'

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
    const { currentPassword, newPassword } = await request.json()
    if (!currentPassword || !newPassword) {
      return jsonResponse({ success: false, error: 'Missing password fields' }, 400, request, env)
    }

    const sql = neon(env.DATABASE_URL)
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    const envPassword = env.PASSWORD || ''
    const storedCredential = await getEffectivePassword(sql, envPassword)
    if (!(await verifyPassword(currentPassword, storedCredential))) {
      return jsonResponse({ success: false, error: 'Invalid current password' }, 401, request, env)
    }

    const hash = await hashPassword(newPassword)
    await savePasswordHash(sql, hash)
    await incrementPasswordVersion(sql)

    return jsonResponse({ success: true }, 200, request, env)
  } catch (_e) {
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, request, env)
  }
}
