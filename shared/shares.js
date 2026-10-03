import { serializeTags, parseTags } from './notes.js'
import { toIsoString } from './util.js'

export const SHARE_EXPIRES_IN = /** @type {const} */ (['1d', '7d', '30d', 'never'])

/** @typedef {'1d' | '7d' | '30d' | 'never'} ShareExpiresIn */

/**
 * @param {ShareExpiresIn | string | undefined} expiresIn
 * @param {Date} [now]
 * @returns {string | null} ISO expires_at or null for never
 */
export function resolveExpiresAt(expiresIn, now = new Date()) {
  const value = SHARE_EXPIRES_IN.includes(/** @type {ShareExpiresIn} */ (expiresIn))
    ? expiresIn
    : '7d'
  if (value === 'never') return null
  const ms = value === '1d' ? 86400000 : value === '30d' ? 30 * 86400000 : 7 * 86400000
  return new Date(now.getTime() + ms).toISOString()
}

export function generateShareToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapShareRow(row) {
  return {
    token: String(row.token),
    noteId: String(row.note_id),
    title: String(row.title || ''),
    content: String(row.content || ''),
    tags: parseTags(row.tags),
    createdAt: toIsoString(row.created_at),
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : null,
    revokedAt: row.revoked_at ? toIsoString(row.revoked_at) : null,
  }
}

/**
 * @param {ReturnType<typeof mapShareRow>} share
 * @param {Date} [now]
 */
export function getShareAccessError(share, now = new Date()) {
  if (!share) return { status: 404, error: '分享不存在' }
  if (share.revokedAt) return { status: 410, error: '分享已撤销' }
  if (isShareExpired(share, now)) {
    return { status: 410, error: '分享已过期' }
  }
  return null
}

/**
 * @param {ReturnType<typeof mapShareRow> | null | undefined} share
 * @param {Date} [now]
 */
export function isShareExpired(share, now = new Date()) {
  return Boolean(share?.expiresAt && new Date(share.expiresAt).getTime() <= now.getTime())
}

/** 公开访客可见字段（不含 noteId） */
export function toPublicSharePayload(share) {
  return {
    title: share.title,
    content: share.content,
    tags: share.tags,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
  }
}

/** 列表项（含 token，供撤销） */
export function toShareListItem(share) {
  return {
    token: share.token,
    urlPath: `/s/${share.token}`,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
  }
}

/**
 * @param {{ noteId: string, title: string, content: string, tags?: string[], expiresIn?: string }} body
 */
export function normalizeCreateShareBody(body) {
  const noteId = typeof body?.noteId === 'string' ? body.noteId.trim() : ''
  const title = typeof body?.title === 'string' ? body.title : ''
  const content = typeof body?.content === 'string' ? body.content : ''
  if (!noteId) return { error: 'noteId required' }
  if (typeof title !== 'string' || typeof content !== 'string') {
    return { error: 'Invalid title or content' }
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    return { error: 'Tags must be an array' }
  }
  const expiresIn = /** @type {ShareExpiresIn} */ (
    SHARE_EXPIRES_IN.includes(/** @type {ShareExpiresIn} */ (body.expiresIn))
      ? body.expiresIn
      : '7d'
  )
  return {
    noteId,
    title,
    content,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    expiresIn,
    expiresAt: resolveExpiresAt(expiresIn),
    tagsJson: serializeTags(Array.isArray(body.tags) ? body.tags : []),
  }
}

export const CREATE_SHARES_TABLE_PG = `
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

export const CREATE_SHARES_INDEX_NOTE_ID_PG =
  'CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id)'

export const CREATE_SHARES_TABLE_D1 = `
  CREATE TABLE IF NOT EXISTS note_shares (
    token TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    revoked_at TEXT
  )
`

export const CREATE_SHARES_INDEX_NOTE_ID_D1 =
  'CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id)'
