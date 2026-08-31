import { SQL } from './sql.js'
import { mapRowToSummary, mapRowToDetail, normalizeImportNote, serializeTags } from './notes.js'

export async function ensureNotesTable(pool) {
  await pool.query(SQL.CREATE_NOTES_TABLE)
}

export async function listNoteSummaries(pool) {
  const result = await pool.query(SQL.SELECT_NOTE_SUMMARIES)
  return result.rows.map(mapRowToSummary)
}

export async function listNoteSummariesPage(pool, page, limit) {
  const offset = (page - 1) * limit
  const [rows, count] = await Promise.all([
    pool.query(SQL.SELECT_NOTE_SUMMARIES_PAGE, [limit, offset]),
    pool.query(SQL.COUNT_NOTES),
  ])
  const total = count.rows[0]?.total ?? 0
  const items = rows.rows.map(mapRowToSummary)
  return { items, total, page, limit, hasMore: page * limit < total }
}

export async function listNotesWithContent(pool) {
  const result = await pool.query(SQL.SELECT_NOTES_WITH_CONTENT)
  return result.rows.map(mapRowToDetail)
}

export async function getNoteById(pool, id) {
  const result = await pool.query(SQL.SELECT_NOTE_BY_ID, [id])
  if (!result.rows.length) return null
  return mapRowToDetail(result.rows[0])
}

export async function upsertNote(pool, note) {
  const normalized = normalizeImportNote(note)
  await pool.query(SQL.UPSERT_NOTE, [
    normalized.id,
    normalized.title,
    normalized.content,
    serializeTags(normalized.tags),
    normalized.createdAt,
    normalized.updatedAt,
  ])
  return normalized.id
}

export async function updateNote(pool, id, { title, content, tags }) {
  await pool.query(SQL.UPDATE_NOTE, [
    title,
    content,
    serializeTags(tags),
    new Date().toISOString(),
    id,
  ])
}

export async function deleteNote(pool, id) {
  await pool.query(SQL.DELETE_NOTE, [id])
}

export async function deleteAllNotes(pool) {
  await pool.query(SQL.DELETE_ALL_NOTES)
}

export async function importNotes(pool, notes) {
  if (!Array.isArray(notes)) return 0
  let imported = 0
  for (const item of notes) {
    if (!item?.title && !item?.content) continue
    await upsertNote(pool, item)
    imported += 1
  }
  return imported
}

export async function replaceAllNotes(pool, notes) {
  await deleteAllNotes(pool)
  return importNotes(pool, notes)
}
