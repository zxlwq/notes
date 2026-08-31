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
  if (plain.length !== stored.length) return false
  let mismatch = 0
  for (let i = 0; i < plain.length; i++) {
    mismatch |= plain.charCodeAt(i) ^ stored.charCodeAt(i)
  }
  return mismatch === 0
}

export async function verifyPassword(plain, stored) {
  if (!stored || typeof plain !== 'string') return false
  if (isPasswordHash(stored)) {
    const matched = await bcrypt.compare(plain, stored)
    return matched
  }
  return verifyLegacyPlaintext(plain, stored)
}

export async function rehashLegacyPassword(sql, plain, stored) {
  if (isPasswordHash(stored)) return stored
  const hash = await hashPassword(plain)
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('password', ${hash}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('password_set', 'true', NOW())
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
  `
  return hash
}

export async function savePasswordHash(sql, hash) {
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('password', ${hash}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('password_set', 'true', NOW())
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
  `
}
