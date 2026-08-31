import bcrypt from 'bcryptjs'

import type { D1Database } from '../types'

const BCRYPT_ROUNDS = 12

export function isPasswordHash(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith('$2')
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

function verifyLegacyPlaintext(plain: string, stored: string): boolean {
  if (plain.length !== stored.length) return false
  let mismatch = 0
  for (let i = 0; i < plain.length; i++) {
    mismatch |= plain.charCodeAt(i) ^ stored.charCodeAt(i)
  }
  return mismatch === 0
}

export async function verifyPassword(
  plain: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored || typeof plain !== 'string') return false
  if (isPasswordHash(stored)) {
    return bcrypt.compare(plain, stored)
  }
  return verifyLegacyPlaintext(plain, stored)
}

export async function rehashLegacyPassword(
  db: D1Database,
  plain: string,
  stored: string
): Promise<string> {
  if (isPasswordHash(stored)) return stored
  const hash = await hashPassword(plain)
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('password', ?, strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')`
    )
    .bind(hash)
    .run()
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('password_set', 'true', strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')`
    )
    .run()
  return hash
}

export async function savePasswordHash(db: D1Database, hash: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('password', ?, strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')`
    )
    .bind(hash)
    .run()
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('password_set', 'true', strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')) ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')`
    )
    .run()
}
