import { neon } from '@neondatabase/serverless'
import { jsonResponse } from '../../_utils/auth.js'
import { apiPreflight } from '../../_utils/cors.js'

const DEFAULT_LOG_RETENTION_DAYS = 7

function verifyCronToken(request, token) {
  if (!token) return true
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${token}`
}

/**
 * EdgeOne Pages schedules：每日按保留期清理 Neon 旧日志。
 * 与 Vercel `api/cron/logs.js` 路径对齐。
 *
 * 注意：EdgeOne schedules 无法自定义 Authorization；若配置了 TOKEN，
 * 平台定时调用会 401，需改用外部 Cron 带 Bearer，或暂时不设 TOKEN。
 */
export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: apiPreflight(request, env, 'GET, POST, OPTIONS'),
    })
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, request, env)
  }

  if (!verifyCronToken(request, env.TOKEN)) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request, env)
  }

  if (!env.DATABASE_URL) {
    return jsonResponse({ success: false, error: 'DATABASE_URL not configured' }, 500, request, env)
  }

  try {
    const days = Math.max(
      1,
      Number.parseInt(String(env.LOG_RETENTION_DAYS ?? ''), 10) || DEFAULT_LOG_RETENTION_DAYS
    )
    const sql = neon(env.DATABASE_URL)
    const rows = await sql`
      DELETE FROM logs
      WHERE created_at < NOW() - (${String(days)} || ' days')::interval
      RETURNING id
    `
    const deleted = rows.length
    return jsonResponse({ success: true, deleted, retentionDays: days }, 200, request, env)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[cron/logs]', error)
    return jsonResponse({ success: false, error: message }, 500, request, env)
  }
}
