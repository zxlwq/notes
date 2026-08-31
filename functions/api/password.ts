import { logToD1 } from '../_utils/log'
import { checkAuth, getEffectivePassword } from '../_utils/auth'
import { verifyPassword, hashPassword, savePasswordHash } from '../_utils/password'
import { incrementPasswordVersion } from '../_utils/credentials'
import { triggerPgSync } from '../_utils/pgSync'
import type { PagesFunction } from '../types'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env),
    })
  }

  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  try {
    const { currentPassword, newPassword } = await request.json()
    if (!currentPassword || !newPassword) {
      await logToD1(env, 'warn', 'password.change.missing_fields')
      return new Response(JSON.stringify({ error: 'Missing password fields' }), {
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

    const storedCredential = await getEffectivePassword(env)

    if (!(await verifyPassword(currentPassword, storedCredential))) {
      await logToD1(env, 'warn', 'password.change.invalid_current')
      return new Response(JSON.stringify({ error: 'Invalid current password' }), {
        status: 401,
        headers: apiCors(request, env),
      })
    }

    const hash = await hashPassword(newPassword)
    await savePasswordHash(env.NOTESD, hash)
    await incrementPasswordVersion(env)

    await logToD1(env, 'info', 'password.change.success')
    triggerPgSync(context)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: apiCors(request, env),
    })
  } catch (error) {
    console.error('Change password error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logToD1(env, 'error', 'password.change.exception', { message: errorMessage })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
