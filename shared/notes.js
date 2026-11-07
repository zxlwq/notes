import { safeJsonParse, toIsoString } from './util.js'

export function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map(String)
  return safeJsonParse(raw, [])
}

export function mapRowToSummary(row) {
  return {
    id: row.id,
    title: row.title || '',
    tags: parseTags(row.tags),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    contentLength: Number(row.content_length) || 0,
  }
}

export function mapRowToDetail(row) {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    tags: parseTags(row.tags),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

export function normalizeImportNote(item) {
  const now = new Date().toISOString()
  return {
    id: item.id || String(Date.now() + Math.random()),
    title: item.title || '',
    content: item.content || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    createdAt: item.createdAt || item.created_at || now,
    updatedAt: item.updatedAt || item.updated_at || now,
  }
}

export function serializeTags(tags) {
  return JSON.stringify(Array.isArray(tags) ? tags : [])
}
