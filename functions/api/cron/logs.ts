import type { PagesFunction, D1Database, ServiceBinding } from '../../types'
import { pruneOldLogsD1, DEFAULT_LOG_RETENTION_DAYS } from '../../../shared/d1-logRet.js'
import { runD1Migrations } from '../../../shared/d1-migrate.js'

function verifyCronSecret(request: Request, cronSecret: string | undefined): boolean {
  if (!cronSecret) return true
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${cronSecret}`
}

async function pruneLocalD1(env: {
  NOTESD?: D1Database
  LOG_RETENTION_DAYS?: string
}): Promise<Response> {
  const db = env.NOTESD
  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  const days =
    Number.parseInt(String(env.LOG_RETENTION_DAYS ?? ''), 10) || DEFAULT_LOG_RETENTION_DAYS
  await runD1Migrations(db)
  const deleted = await pruneOldLogsD1(db, days)
  return new Response(JSON.stringify({ success: true, deleted, retentionDays: days }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * Cloudflare Pages：经 Service Binding 调用 notes-log-cron Worker，或回退本地 D1。
 * 与 Vercel `api/cron/logs.js` 路径对齐。
 */
export const onRequest: PagesFunction = async ({ request, env }) => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  if (!verifyCronSecret(request, env.TOKEN as string | undefined)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  const logCron = env.LOG_CRON as ServiceBinding | undefined
  if (logCron) {
    try {
      return await logCron.fetch(
        new Request('https://notes-log-cron/cleanup', {
          method: request.method,
          headers: request.headers,
        })
      )
    } catch (error: unknown) {
      console.error('[cron/logs] service binding failed:', error)
    }
  }

  try {
    return await pruneLocalD1(env)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error'
    console.error('[cron/logs]', error)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}
