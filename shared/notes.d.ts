export function parseTags(raw: unknown): string[]

export function mapRowToSummary(row: {
  id: string
  title?: string
  tags?: string | null
  created_at?: Date | string
  updated_at?: Date | string
  content_length?: number | string
}): {
  id: string
  title: string
  tags: string[]
  createdAt: string
  updatedAt: string
  contentLength: number
}

export function mapRowToDetail(row: {
  id: string
  title?: string
  content?: string
  tags?: string | null
  created_at?: Date | string
  updated_at?: Date | string
}): {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export function normalizeImportNote(item: Record<string, unknown>): ParsedNoteLike

export function serializeTags(tags: unknown): string

interface ParsedNoteLike {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}
