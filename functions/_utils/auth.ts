import { extractAndVerifySession } from './session'
import { getPasswordVersion } from './credentials'
import type { D1Database } from '../types'

interface AuthEnv {
  PASSWORD?: string
  JWT_SECRET?: string
  NODE_ENV?: string
  NOTESD?: D1Database
}

export async function getEffectivePassword(env: AuthEnv): Promise<string | null> {
  const envPassword = env.PASSWORD || ''
  if (!env.NOTESD) return envPassword || null
  try {
    await env.NOTESD.exec(
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`
    )
    const row = await env.NOTESD.prepare(
      `SELECT value FROM settings WHERE key = 'password'`
    ).first<{
      value: string
    }>()
    const flagRow = await env.NOTESD.prepare(
      `SELECT value FROM settings WHERE key = 'password_set'`
    ).first<{ value: string }>()
    if (flagRow?.value === 'true' && row?.value) return row.value
  } catch {
    // fall through
  }
  return envPassword || null
}

export async function checkAuth(request: Request, env: AuthEnv): Promise<boolean> {
  const stored = await getEffectivePassword(env)
  if (!stored) return false
  const pwdVer = await getPasswordVersion(env)
  const isProduction = env.NODE_ENV === 'production'
  const signingPassword = env.PASSWORD || ''
  return extractAndVerifySession(request, signingPassword, env.JWT_SECRET, pwdVer, isProduction)
}
