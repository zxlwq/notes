import { D1_SQL } from './d1-sql.js'
import { mapRowToSummary, mapRowToDetail, normalizeImportNote, serializeTags } from './notes.js'
import { parsePageLimit, buildNotesListResponse } from './pagination.js'
import { runD1Migrations } from './d1-migrate.js'

export async function ensureNotesTable(db) {
  await db.prepare(D1_SQL.CREATE_NOTES_TABLE).run()
  await runD1Migrations(db)
}

export async function listNoteSummaries(db) {
  const result = await db.prepare(D1_SQL.SELECT_NOTE_SUMMARIES).all()
  return (result.results || []).map(mapRowToSummary)
}

export async function listNoteSummariesPage(db, page, limit) {
  const { offset } = parsePageLimit({ page, limit })
  const [rows, countRow] = await Promise.all([
    db.prepare(D1_SQL.SELECT_NOTE_SUMMARIES_PAGE).bind(limit, offset).all(),
    db.prepare(D1_SQL.COUNT_NOTES).first(),
  ])
  const total = Number(countRow?.total) || 0
  const items = (rows.results || []).map(mapRowToSummary)
  return buildNotesListResponse(items, total, page, limit)
}

export async function listNotesWithContent(db) {
  const rows = await db
    .prepare(
      `SELECT id, title, content, tags, created_at, updated_at FROM notes ORDER BY updated_at DESC`
    )
    .all()
  return (rows.results || []).map(mapRowToDetail)
}

export async function getNoteById(db, id) {
  const row = await db.prepare(D1_SQL.SELECT_NOTE_BY_ID).bind(id).first()
  if (!row) return null
  return mapRowToDetail(row)
}

export async function noteExists(db, id) {
  const row = await db.prepare(D1_SQL.NOTE_EXISTS).bind(id).first()
  return Boolean(row)
}

export async function upsertDefaultNote(db, content) {
  await db.prepare(D1_SQL.UPSERT_DEFAULT_NOTE).bind(content).run()
}

export async function createNote(db, { id, title, content, tags = [], createdAt, updatedAt }) {
  if (id) {
    return upsertNote(db, {
      id,
      title,
      content,
      tags,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: updatedAt || new Date().toISOString(),
    })
  }
  const noteId = Date.now().toString()
  await db.prepare(D1_SQL.INSERT_NOTE).bind(noteId, title, content, serializeTags(tags)).run()
  return noteId
}

export async function upsertNote(db, note) {
  const normalized = normalizeImportNote(note)
  await db
    .prepare(D1_SQL.UPSERT_NOTE)
    .bind(
      normalized.id,
      normalized.title,
      normalized.content,
      serializeTags(normalized.tags),
      normalized.createdAt,
      normalized.updatedAt
    )
    .run()
  return normalized.id
}

export async function updateNote(db, id, { title, content, tags = [] }) {
  if (!(await noteExists(db, id))) return false
  await db.prepare(D1_SQL.UPDATE_NOTE).bind(title, content, serializeTags(tags), id).run()
  return true
}

export async function deleteNote(db, id) {
  if (!(await noteExists(db, id))) return false
  await db.prepare(D1_SQL.DELETE_NOTE).bind(id).run()
  return true
}

export async function deleteAllNotes(db) {
  await db.prepare(D1_SQL.DELETE_ALL_NOTES).run()
}

export async function importNotes(db, notes) {
  if (!Array.isArray(notes)) return 0
  let imported = 0
  for (const item of notes) {
    if (!item?.title && !item?.content) continue
    await upsertNote(db, item)
    imported += 1
  }
  return imported
}

export async function replaceAllNotes(db, notes) {
  await deleteAllNotes(db)
  return importNotes(db, notes)
}
