export type ShareExpiresIn = '1d' | '7d' | '30d' | 'never'

export const SHARE_EXPIRES_IN: readonly ShareExpiresIn[]

export function resolveExpiresAt(expiresIn?: ShareExpiresIn | string, now?: Date): string | null
export function generateShareToken(): string

export interface MappedShare {
  token: string
  noteId: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
}

export interface ShareAccessError {
  status: number
  error: string
}

export interface ShareListItem {
  token: string
  urlPath: string
  createdAt: string
  expiresAt: string | null
}

export interface PublicSharePayload {
  title: string
  content: string
  tags: string[]
  createdAt: string
  expiresAt: string | null
}

export function mapShareRow(row: Record<string, unknown>): MappedShare
export function getShareAccessError(share: MappedShare | null, now?: Date): ShareAccessError | null
export function isShareExpired(share: MappedShare | null | undefined, now?: Date): boolean
export function toPublicSharePayload(share: MappedShare): PublicSharePayload
export function toShareListItem(share: MappedShare): ShareListItem

/** 宽松返回类型，便于各后端在 checkJs / tsc 下统一判断 error */
export function normalizeCreateShareBody(body: unknown): {
  noteId?: string
  title?: string
  content?: string
  tags?: string[]
  expiresIn?: ShareExpiresIn
  expiresAt?: string | null
  tagsJson?: string
  error?: string
}

export const CREATE_SHARES_TABLE_PG: string
export const CREATE_SHARES_INDEX_NOTE_ID_PG: string
export const CREATE_SHARES_TABLE_D1: string
export const CREATE_SHARES_INDEX_NOTE_ID_D1: string
