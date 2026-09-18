import type { D1Database } from '../types'

interface VersionEnv {
  NOTESD?: D1Database
}

export async function getPasswordVersion(env: VersionEnv): Promise<number> {
  if (!env.NOTESD) return 0
  try {
    const row = await env.NOTESD.prepare(
      `SELECT value FROM settings WHERE key = 'password_version'`
    ).first<{ value: string }>()
    const version = parseInt(row?.value ?? '0', 10)
    return Number.isFinite(version) ? version : 0
  } catch {
    return 0
  }
}

export async function incrementPasswordVersion(env: VersionEnv): Promise<number> {
  if (!env.NOTESD) return 0
  const next = (await getPasswordVersion(env)) + 1
  await env.NOTESD.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('password_version', ?, strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')`
  )
    .bind(String(next))
    .run()
  return next
}
