import type { MappedShare, PublicSharePayload, ShareAccessError, ShareListItem } from './shares.js'

export interface PgPoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows?: unknown[] }>
}

export function ensureSharesTable(pool: PgPoolLike): Promise<void>

export function createShare(
  pool: PgPoolLike,
  input: {
    noteId: string
    title: string
    content: string
    tagsJson: string
    expiresAt: string | null
  }
): Promise<MappedShare>

export function getShareByToken(pool: PgPoolLike, token: string): Promise<MappedShare | null>

export function getPublicShare(
  pool: PgPoolLike,
  token: string
): Promise<
  { share: PublicSharePayload; error?: undefined } | { share?: undefined; error: ShareAccessError }
>

export function revokeShare(pool: PgPoolLike, token: string): Promise<boolean>
export function revokeSharesByNoteId(pool: PgPoolLike, noteId: string): Promise<void>
/** 批量将过期分享写入 revoked_at，返回影响行数 */
export function revokeExpiredShares(pool: PgPoolLike): Promise<number>
export function listSharesByNoteId(pool: PgPoolLike, noteId: string): Promise<ShareListItem[]>
