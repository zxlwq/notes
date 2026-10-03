import { checkAuth } from '../../_utils/auth'
import type { PagesFunction } from '../../types'
import { apiCors, apiPreflight } from '../../_utils/cors'

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'GET, OPTIONS'),
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
      return Response.json({ configured: false }, { headers: apiCors(request, env) })
    }
    await env.NOTESD.exec(
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`
    )
    const row = await env.NOTESD.prepare(
      `SELECT value FROM settings WHERE key = 'recovery_hash'`
    ).first<{ value: string }>()
    return Response.json({ configured: Boolean(row?.value) }, { headers: apiCors(request, env) })
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
