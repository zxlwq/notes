import {
  generateShareToken,
  mapShareRow,
  getShareAccessError,
  isShareExpired,
  toPublicSharePayload,
  toShareListItem,
} from './shares.js'

/** @param {any} sql */
export async function ensureSharesTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS note_shares (
      token TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id)`
}

/** @param {any} sql */
export async function createShare(sql, { noteId, title, content, tagsJson, expiresAt }) {
  const token = generateShareToken()
  const createdAt = new Date().toISOString()
  await sql`
    INSERT INTO note_shares (token, note_id, title, content, tags, created_at, expires_at, revoked_at)
    VALUES (${token}, ${noteId}, ${title}, ${content}, ${tagsJson}, ${createdAt}, ${expiresAt}, NULL)
  `
  const rows = await sql`
    SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
    FROM note_shares WHERE token = ${token}
  `
  return mapShareRow(rows[0])
}

/** @param {any} sql */
export async function getShareByToken(sql, token) {
  const rows = await sql`
    SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
    FROM note_shares WHERE token = ${token}
  `
  if (!rows[0]) return null
  return mapShareRow(rows[0])
}

/** @param {any} sql */
export async function revokeExpiredShares(sql) {
  const rows = await sql`
    UPDATE note_shares SET revoked_at = NOW()
    WHERE revoked_at IS NULL
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()
    RETURNING token
  `
  return rows.length
}

/** @param {any} sql */
export async function getPublicShare(sql, token) {
  const share = await getShareByToken(sql, token)
  const err = getShareAccessError(share)
  if (err) {
    if (share && isShareExpired(share) && !share.revokedAt) {
      await revokeShare(sql, share.token)
    }
    return { error: err }
  }
  return { share: toPublicSharePayload(share) }
}

/** @param {any} sql */
export async function revokeShare(sql, token) {
  const existing = await getShareByToken(sql, token)
  if (!existing) return false
  if (existing.revokedAt) return true
  await sql`
    UPDATE note_shares SET revoked_at = NOW() WHERE token = ${token} AND revoked_at IS NULL
  `
  return true
}

/** @param {any} sql */
export async function revokeSharesByNoteId(sql, noteId) {
  await sql`
    UPDATE note_shares SET revoked_at = NOW() WHERE note_id = ${noteId} AND revoked_at IS NULL
  `
}

/** @param {any} sql */
export async function listSharesByNoteId(sql, noteId) {
  await revokeExpiredShares(sql)
  const rows = await sql`
    SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
    FROM note_shares
    WHERE note_id = ${noteId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `
  return rows.map(mapShareRow).map(toShareListItem)
}
