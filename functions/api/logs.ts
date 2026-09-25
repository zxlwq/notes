import type { PagesFunction, D1Database } from '../types'
import { checkAuth } from '../_utils/auth'
import { pruneOldLogsD1, DEFAULT_LOG_RETENTION_DAYS } from '../../shared/d1-logRet.js'
import { apiCors, apiPreflight } from '../_utils/cors'

// 数据库日志行类型
interface LogRow {
  id?: number
  level?: string
  message?: string
  meta?: string
  created_at?: string
}

// 解析后的 meta 对象类型
interface ParsedMeta {
  title?: string
  count?: number
  id?: string
  location?: string
  ip?: string
  [key: string]: unknown
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  try {
    const db = env.NOTESD as D1Database | undefined
    if (db) {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY,
          level TEXT,
          message TEXT NOT NULL,
          meta TEXT,
          created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours'))
        )`
        )
        .run()
      await db.prepare(`CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs(created_at)`).run()
      const result = await db
        .prepare(
          'SELECT id, level, message, meta, created_at FROM logs ORDER BY datetime(created_at) DESC LIMIT 200'
        )
        .all<LogRow>()

      const items = (result.results || []).map((row: LogRow) => {
        let detail = ''
        let parsed: ParsedMeta | string | null = null
        try {
          parsed = row.meta ? (JSON.parse(row.meta) as ParsedMeta) : null
        } catch {}

        if (parsed && typeof parsed === 'object' && parsed !== null) {
          if (typeof parsed.title === 'string' && parsed.title) {
            detail = parsed.title
          } else if (typeof parsed.count === 'number') {
            detail = `数量: ${parsed.count}`
          } else if (typeof parsed.id === 'string') {
            detail = parsed.id
          } else if (typeof parsed.location === 'string' && parsed.location) {
            const ip = typeof parsed.ip === 'string' ? parsed.ip : ''
            detail = `位置: ${parsed.location}${ip ? ` · IP: ${ip}` : ''}`
          }
        } else if (typeof parsed === 'string' && parsed) {
          detail = parsed
        } else if (typeof row.meta === 'string' && row.meta && row.meta[0] !== '{') {
          detail = row.meta
        }

        return { ...row, detail }
      })

      return new Response(
        JSON.stringify({
          success: true,
          source: 'd1',
          count: items.length,
          items,
        }),
        { headers: { 'content-type': 'application/json; charset=utf-8' } }
      )
    }

    return new Response(JSON.stringify({ success: true, source: 'none', count: 0, items: [] }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '日志获取失败'
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}

export const onRequestDelete: PagesFunction = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  try {
    const db = env.NOTESD as D1Database | undefined
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    }
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY,
        level TEXT,
        message TEXT NOT NULL,
        meta TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours'))
      )`
      )
      .run()
    const res = await db.prepare('DELETE FROM logs').run()
    return new Response(JSON.stringify({ success: true, deleted: res.meta?.changes ?? null }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '清空日志失败'
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  try {
    const db = env.NOTESD as D1Database | undefined
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    }

    const days =
      Number.parseInt(String(env.LOG_RETENTION_DAYS ?? DEFAULT_LOG_RETENTION_DAYS), 10) ||
      DEFAULT_LOG_RETENTION_DAYS
    const deleted = await pruneOldLogsD1(db, days)
    return new Response(JSON.stringify({ success: true, deleted, retentionDays: days }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '日志清理失败'
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}

export const onRequestOptions: PagesFunction = async ({ request, env }) => {
  return new Response(null, {
    status: 204,
    headers: apiPreflight(request, env, 'GET, POST, DELETE, OPTIONS'),
  })
}
