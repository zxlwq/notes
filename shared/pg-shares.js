import { runMigrations } from './migrate.js'
import {
  CREATE_SHARES_TABLE_PG,
  CREATE_SHARES_INDEX_NOTE_ID_PG,
  generateShareToken,
  mapShareRow,
  getShareAccessError,
  isShareExpired,
  toPublicSharePayload,
  toShareListItem,
} from './shares.js'

export async function ensureSharesTable(pool) {
  await pool.query(CREATE_SHARES_TABLE_PG)
  await pool.query(CREATE_SHARES_INDEX_NOTE_ID_PG)
  await runMigrations(pool)
}

export async function createShare(pool, { noteId, title, content, tagsJson, expiresAt }) {
  const token = generateShareToken()
  const createdAt = new Date().toISOString()
  await pool.query(
    `INSERT INTO note_shares (token, note_id, title, content, tags, created_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
    [token, noteId, title, content, tagsJson, createdAt, expiresAt]
  )
  const result = await pool.query(
    `SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
     FROM note_shares WHERE token = $1`,
    [token]
  )
  return mapShareRow(result.rows[0])
}

export async function getShareByToken(pool, token) {
  const result = await pool.query(
    `SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
     FROM note_shares WHERE token = $1`,
    [token]
  )
  if (!result.rows[0]) return null
  return mapShareRow(result.rows[0])
}

/** 将已过期且未撤销的分享写入 revoked_at；返回撤销条数 */
export async function revokeExpiredShares(pool) {
  const result = await pool.query(
    `UPDATE note_shares SET revoked_at = NOW()
     WHERE revoked_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()`
  )
  return result.rowCount ?? 0
}

export async function getPublicShare(pool, token) {
  const share = await getShareByToken(pool, token)
  const err = getShareAccessError(share)
  if (err) {
    if (share && isShareExpired(share) && !share.revokedAt) {
      await revokeShare(pool, share.token)
    }
    return { error: err }
  }
  return { share: toPublicSharePayload(share) }
}

export async function revokeShare(pool, token) {
  const existing = await getShareByToken(pool, token)
  if (!existing) return false
  if (existing.revokedAt) return true
  await pool.query(
    `UPDATE note_shares SET revoked_at = NOW() WHERE token = $1 AND revoked_at IS NULL`,
    [token]
  )
  return true
}

export async function revokeSharesByNoteId(pool, noteId) {
  await pool.query(
    `UPDATE note_shares SET revoked_at = NOW() WHERE note_id = $1 AND revoked_at IS NULL`,
    [noteId]
  )
}

export async function listSharesByNoteId(pool, noteId) {
  await revokeExpiredShares(pool)
  const result = await pool.query(
    `SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
     FROM note_shares
     WHERE note_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [noteId]
  )
  return result.rows.map(mapShareRow).map(toShareListItem)
}
