import { checkAuth } from '../../_utils/auth'
import type { PagesFunction, D1Database } from '../../types'
import { apiCors, apiPreflight } from '../../_utils/cors'

export const onRequestGet: PagesFunction<{
  NOTESD: D1Database
  PASSWORD?: string
}> = async ({ request, env }) => {
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
    let useD1Password = false
    let effectivePassword = env.PASSWORD as string | undefined
    try {
      await env.NOTESD.exec(
        `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`
      )
      const row = await env.NOTESD.prepare(
        `SELECT value FROM settings WHERE key = 'password'`
      ).first<{ value: string }>()
      const flagRow = await env.NOTESD.prepare(
        `SELECT value FROM settings WHERE key = 'password_set'`
      ).first<{ value: string }>()
      useD1Password = flagRow?.value === 'true'
      if (useD1Password && row?.value) effectivePassword = row.value
    } catch (e) {
      console.error('Read password from D1 failed:', e)
    }

    const hasEnvPassword = Boolean(env.PASSWORD)

    const hasDbPassword = useD1Password && Boolean(effectivePassword)

    return Response.json(
      {
        success: true,
        usingD1: true,
        usingPostgreSQL: false,
        hasEnvPassword,
        hasDbPassword,
        passwordSource: useD1Password ? 'd1' : 'env',
      },
      { headers: apiCors(request, env) }
    )
  } catch (error) {
    console.error('Password status API error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: apiCors(request, env),
      }
    )
  }
}
