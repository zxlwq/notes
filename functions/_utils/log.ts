import type { D1Database } from '../types'

export async function logToD1(
  env: { NOTESD?: D1Database },
  level: string,
  message: string,
  meta?: unknown
) {
  try {
    if (!env?.NOTESD) return
    await env.NOTESD.prepare(
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY,
        level TEXT,
        message TEXT NOT NULL,
        meta TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours'))
      )`
    ).run()
    await env.NOTESD.prepare(
      `CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs(created_at)`
    ).run()
    const metaJson = meta ? JSON.stringify(meta) : null
    await env.NOTESD.prepare(
      `INSERT INTO logs(level, message, meta, created_at) VALUES(?, ?, ?, strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours'))`
    )
      .bind(level, message, metaJson)
      .run()
  } catch (e) {
    console.error('logToD1 error:', e)
  }
}
