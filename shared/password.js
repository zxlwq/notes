import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

export function isPasswordHash(stored) {
  return typeof stored === 'string' && stored.startsWith('$2')
}

export async function hashPassword(plain) {
  const hash = await bcrypt.hash(plain, BCRYPT_ROUNDS)
  return hash
}

function verifyLegacyPlaintext(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false
  const a = Buffer.from(plain)
  const b = Buffer.from(stored)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function verifyPassword(plain, stored) {
  if (!stored || typeof plain !== 'string') return false
  if (isPasswordHash(stored)) {
    const matched = await bcrypt.compare(plain, stored)
    return matched
  }
  return verifyLegacyPlaintext(plain, stored)
}

export async function rehashLegacyPassword(pool, plain, stored) {
  if (isPasswordHash(stored)) return stored
  const hash = await hashPassword(plain)
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('password', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [hash]
  )
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('password_set', 'true', NOW())
     ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`
  )
  return hash
}

export async function savePasswordHash(pool, hash) {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('password', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [hash]
  )
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('password_set', 'true', NOW())
     ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`
  )
}
