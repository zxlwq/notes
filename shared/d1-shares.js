import { D1_NOW } from './d1-sql.js'
import { runD1Migrations } from './d1-migrate.js'
import {
  CREATE_SHARES_TABLE_D1,
  CREATE_SHARES_INDEX_NOTE_ID_D1,
  generateShareToken,
  mapShareRow,
  getShareAccessError,
  isShareExpired,
  toPublicSharePayload,
  toShareListItem,
} from './shares.js'

export async function ensureSharesTable(db) {
  await db.prepare(CREATE_SHARES_TABLE_D1).run()
  await db.prepare(CREATE_SHARES_INDEX_NOTE_ID_D1).run()
  await runD1Migrations(db)
}

export async function createShare(db, { noteId, title, content, tagsJson, expiresAt }) {
  const token = generateShareToken()
  await db
    .prepare(
      `INSERT INTO note_shares (token, note_id, title, content, tags, created_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ${D1_NOW}, ?, NULL)`
    )
    .bind(token, noteId, title, content, tagsJson, expiresAt)
    .run()
  const row = await db
    .prepare(
      `SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
       FROM note_shares WHERE token = ?`
    )
    .bind(token)
    .first()
  return mapShareRow(row)
}

export async function getShareByToken(db, token) {
  const row = await db
    .prepare(
      `SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
       FROM note_shares WHERE token = ?`
    )
    .bind(token)
    .first()
  if (!row) return null
  return mapShareRow(row)
}

/** 将已过期且未撤销的分享写入 revoked_at；返回撤销条数 */
export async function revokeExpiredShares(db) {
  const nowIso = new Date().toISOString()
  const result = await db
    .prepare(
      `UPDATE note_shares SET revoked_at = ${D1_NOW}
       WHERE revoked_at IS NULL
         AND expires_at IS NOT NULL
         AND expires_at <= ?`
    )
    .bind(nowIso)
    .run()
  return result?.meta?.changes ?? 0
}

export async function getPublicShare(db, token) {
  const share = await getShareByToken(db, token)
  const err = getShareAccessError(share)
  if (err) {
    if (share && isShareExpired(share) && !share.revokedAt) {
      await revokeShare(db, share.token)
    }
    return { error: err }
  }
  return { share: toPublicSharePayload(share) }
}

export async function revokeShare(db, token) {
  const existing = await getShareByToken(db, token)
  if (!existing) return false
  if (existing.revokedAt) return true
  await db
    .prepare(`UPDATE note_shares SET revoked_at = ${D1_NOW} WHERE token = ? AND revoked_at IS NULL`)
    .bind(token)
    .run()
  return true
}

export async function revokeSharesByNoteId(db, noteId) {
  await db
    .prepare(
      `UPDATE note_shares SET revoked_at = ${D1_NOW} WHERE note_id = ? AND revoked_at IS NULL`
    )
    .bind(noteId)
    .run()
}

export async function listSharesByNoteId(db, noteId) {
  await revokeExpiredShares(db)
  const result = await db
    .prepare(
      `SELECT token, note_id, title, content, tags, created_at, expires_at, revoked_at
       FROM note_shares
       WHERE note_id = ? AND revoked_at IS NULL
       ORDER BY created_at DESC`
    )
    .bind(noteId)
    .all()
  return (result.results || []).map(mapShareRow).map(toShareListItem)
}
