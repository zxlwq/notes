import type { D1DatabaseLike } from './d1-notes.js'
import type { MappedShare, PublicSharePayload, ShareAccessError, ShareListItem } from './shares.js'

export function ensureSharesTable(db: D1DatabaseLike): Promise<void>

export function createShare(
  db: D1DatabaseLike,
  input: {
    noteId: string
    title: string
    content: string
    tagsJson: string
    expiresAt: string | null
  }
): Promise<MappedShare>

export function getShareByToken(db: D1DatabaseLike, token: string): Promise<MappedShare | null>

export function getPublicShare(
  db: D1DatabaseLike,
  token: string
): Promise<
  { share: PublicSharePayload; error?: undefined } | { share?: undefined; error: ShareAccessError }
>

export function revokeShare(db: D1DatabaseLike, token: string): Promise<boolean>
export function revokeSharesByNoteId(db: D1DatabaseLike, noteId: string): Promise<void>
/** 批量将过期分享写入 revoked_at，返回影响行数 */
export function revokeExpiredShares(db: D1DatabaseLike): Promise<number>
export function listSharesByNoteId(db: D1DatabaseLike, noteId: string): Promise<ShareListItem[]>
