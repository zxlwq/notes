/**
 * @see https://developers.cloudflare.com/workers/configuration/cron-triggers/
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
 */
const DEFAULT_LOG_RETENTION_DAYS = 7

export default {
  async scheduled(_controller, env) {
    await runPrune(env)
  },

  fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/cleanup') {
      return new Response('notes-log-cron: use /cleanup', { status: 404 })
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }
    if (!verifyCronSecret(request, env.TOKEN)) {
      return json({ success: false, error: 'Unauthorized' }, 401)
    }
    return runPrune(env)
  },
}

function verifyCronSecret(request, cronSecret) {
  if (!cronSecret) return true
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${cronSecret}`
}

async function pruneOldLogsD1(db, days = DEFAULT_LOG_RETENTION_DAYS) {
  const safeDays = Math.max(1, Number.parseInt(String(days), 10) || DEFAULT_LOG_RETENTION_DAYS)
  const result = await db
    .prepare(`DELETE FROM logs WHERE datetime(created_at) < datetime('now', ?)`)
    .bind(`-${safeDays} days`)
    .run()
  return result.meta?.changes ?? 0
}

async function revokeExpiredSharesD1(db) {
  const nowIso = new Date().toISOString()
  const result = await db
    .prepare(
      `UPDATE note_shares SET revoked_at = datetime('now')
       WHERE revoked_at IS NULL
         AND expires_at IS NOT NULL
         AND expires_at <= ?`
    )
    .bind(nowIso)
    .run()
  return result.meta?.changes ?? 0
}

async function runPrune(env) {
  const db = env.NOTESD
  if (!db) {
    console.error('[notes-log-cron] NOTESD not bound')
    return json({ success: false, error: 'Database not bound' }, 500)
  }

  try {
    const days =
      Number.parseInt(String(env.LOG_RETENTION_DAYS ?? ''), 10) || DEFAULT_LOG_RETENTION_DAYS
    const deleted = await pruneOldLogsD1(db, days)
    let revokedShares = 0
    try {
      revokedShares = await revokeExpiredSharesD1(db)
    } catch (shareErr) {
      // note_shares 尚未迁移时忽略
      console.warn('[notes-log-cron] revoke expired shares skipped:', shareErr)
    }
    const body = { success: true, deleted, revokedShares, retentionDays: days }
    console.warn('[notes-log-cron] pruned', body)
    return json(body, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[notes-log-cron]', err)
    return json({ success: false, error: message }, 500)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
