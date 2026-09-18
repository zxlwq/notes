import { checkAuth } from '../../_utils/auth'
import { generateRecoveryCode, hashRecoveryCode } from '../../_utils/session'
import { triggerPgSync } from '../../_utils/pgSync'
import type { PagesFunction } from '../../types'
import { apiCors, apiPreflight } from '../../_utils/cors'

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'POST, OPTIONS'),
    })
  }

  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  try {
    if (!env.NOTESD) {
      return new Response(JSON.stringify({ error: 'Database not bound' }), {
        status: 500,
        headers: apiCors(request, env),
      })
    }
    await env.NOTESD.exec(
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`
    )
    const code = generateRecoveryCode()
    const hash = await hashRecoveryCode(code)
    await env.NOTESD.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('recovery_hash', ?, strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')`
    )
      .bind(hash)
      .run()

    triggerPgSync(context)
    return Response.json({ success: true, recoveryCode: code }, { headers: apiCors(request, env) })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
