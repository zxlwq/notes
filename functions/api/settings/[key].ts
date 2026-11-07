import { logToD1 } from '../../_utils/log'
import { checkAuth } from '../../_utils/auth'
import { triggerPgSync } from '../../_utils/pgSync'
import type { PagesFunction } from '../../types'
import { apiCors, apiPreflight } from '../../_utils/cors'
import { isAllowedUiSettingKey } from '../../../shared/ui-settings.js'

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'GET, POST, OPTIONS'),
    })
  }

  if (!env.NOTESD) {
    return new Response(JSON.stringify({ success: false, error: 'D1 database not available' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }

  const extractKey = (req: Request): string | null => {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts.length >= 3 ? parts[2] : null
  }

  const key = extractKey(request)

  if (!key || !isAllowedUiSettingKey(key)) {
    return new Response(JSON.stringify({ success: false, error: 'Unsupported setting key' }), {
      status: 400,
      headers: apiCors(request, env),
    })
  }

  if (method !== 'GET' && !(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  try {
    await env.NOTESD.prepare(
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )`
    ).run()
  } catch (e) {
    console.error('Failed to create settings table:', e)
  }

  if (method === 'GET') {
    try {
      const row = await env.NOTESD.prepare(`SELECT value FROM settings WHERE key = ?`)
        .bind(key)
        .first<{ value: string }>()

      if (!row || row.value == null || row.value === '') {
        return Response.json({ success: true, data: null }, { headers: apiCors(request, env) })
      }

      let parsed = null
      try {
        parsed = JSON.parse(row.value)
      } catch {
        parsed = row.value
      }

      return Response.json({ success: true, data: parsed }, { headers: apiCors(request, env) })
    } catch (error) {
      console.error('Settings GET error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      await logToD1(env, 'error', 'settings.get_error', { message: errorMessage })
      return new Response(
        JSON.stringify({
          success: false,
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

  if (method === 'POST') {
    try {
      const value = await request.json()

      if (typeof value === 'undefined') {
        return new Response(JSON.stringify({ success: false, error: 'Value is required' }), {
          status: 400,
          headers: apiCors(request, env),
        })
      }

      const valueStr = JSON.stringify(value)
      const now = new Date().toISOString()

      await env.NOTESD.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
        .bind(key, valueStr, now)
        .run()

      try {
        await logToD1(env, 'info', 'settings.saved', { key })
      } catch (e) {
        console.error('Failed to log settings save:', e)
      }

      triggerPgSync(context)
      return Response.json({ success: true }, { headers: apiCors(request, env) })
    } catch (error) {
      console.error('Settings POST error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      await logToD1(env, 'error', 'settings.post_error', { message: errorMessage })
      return new Response(
        JSON.stringify({
          success: false,
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

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: apiCors(request, env),
  })
}
