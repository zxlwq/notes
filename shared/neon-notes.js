import { mapRowToSummary, mapRowToDetail, normalizeImportNote, serializeTags } from './notes.js'
import { parsePageLimit, buildNotesListResponse } from './pagination.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** @param {any} sql */
export async function ensureNotesTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `
}

/** @param {any} sql */
export async function listNoteSummaries(sql) {
  const rows = await sql`
    SELECT id, title, tags, created_at, updated_at, LENGTH(content) AS content_length
    FROM notes
    ORDER BY updated_at DESC
  `
  return rows.map(mapRowToSummary)
}

/** @param {any} sql */
export async function listNoteSummariesPage(sql, page, limit) {
  const { offset } = parsePageLimit({ page, limit })
  const [rows, countRows] = await Promise.all([
    sql`
      SELECT id, title, tags, created_at, updated_at, LENGTH(content) AS content_length
      FROM notes
      ORDER BY updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql`SELECT COUNT(*)::int AS total FROM notes`,
  ])
  const total = Number(countRows[0]?.total) || 0
  const items = rows.map(mapRowToSummary)
  return buildNotesListResponse(items, total, page, limit)
}

/** @param {any} sql */
export async function listNotesWithContent(sql) {
  const rows = await sql`
    SELECT id, title, content, tags, created_at, updated_at
    FROM notes
    ORDER BY updated_at DESC
  `
  return rows.map(mapRowToDetail)
}

/** @param {any} sql */
export async function getNoteById(sql, id) {
  const rows = await sql`SELECT * FROM notes WHERE id = ${id}`
  if (!rows.length) return null
  return mapRowToDetail(rows[0])
}

/** @param {any} sql */
export async function upsertNote(sql, note) {
  const normalized = normalizeImportNote(note)
  await sql`
    INSERT INTO notes (id, title, content, tags, created_at, updated_at)
    VALUES (
      ${normalized.id},
      ${normalized.title},
      ${normalized.content},
      ${serializeTags(normalized.tags)},
      ${normalized.createdAt},
      ${normalized.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      tags = EXCLUDED.tags,
      updated_at = EXCLUDED.updated_at
  `
  return normalized.id
}

/** @param {any} sql */
export async function updateNote(sql, id, { title, content, tags }) {
  await sql`
    UPDATE notes
    SET title = ${title}, content = ${content}, tags = ${serializeTags(tags)}, updated_at = NOW()
    WHERE id = ${id}
  `
}

/** @param {any} sql */
export async function deleteNote(sql, id) {
  await sql`DELETE FROM notes WHERE id = ${id}`
}

/** @param {any} sql */
export async function deleteAllNotes(sql) {
  await sql`DELETE FROM notes`
}

/** @param {any} sql */
export async function importNotes(sql, notes) {
  if (!Array.isArray(notes)) return 0
  let imported = 0
  for (const item of notes) {
    if (!item?.title && !item?.content) continue
    await upsertNote(sql, item)
    imported += 1
  }
  return imported
}

/**
 * 全量替换 Neon 笔记（含 bulk UPSERT + 慢路径回退）
 * @param {any} sql
 * @param {{ onTrace?: (msg: string) => void }} [options]
 */
export async function replaceAllNotes(sql, rawNotes, options = {}) {
  const { onTrace } = options
  const parsedNotes = (rawNotes || []).map(normalizeImportNote)
  if (parsedNotes.length === 0) {
    return { importedCount: 0, updatedCount: 0 }
  }

  await ensureNotesTable(sql)
  await deleteAllNotes(sql)
  onTrace?.('Cleared existing notes before import')

  let importedCount = 0
  let updatedCount = 0

  try {
    const rows = parsedNotes.map((n) => ({
      id: String(n.id),
      title: String(n.title || ''),
      content: String(n.content || ''),
      tags: serializeTags(n.tags),
      created_at: n.createdAt || new Date().toISOString(),
      updated_at: n.updatedAt || new Date().toISOString(),
    }))
    const rowsJson = JSON.stringify(rows)
    await sql`
      INSERT INTO notes (id, title, content, tags, created_at, updated_at)
      SELECT id, title, content, tags, created_at, updated_at
      FROM json_to_recordset(${rowsJson}::json)
        AS x(id text, title text, content text, tags text, created_at timestamptz, updated_at timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        tags = EXCLUDED.tags,
        updated_at = EXCLUDED.updated_at
    `
    importedCount = parsedNotes.length
  } catch (bulkErr) {
    onTrace?.('Bulk UPSERT failed, falling back to slow path: ' + (bulkErr?.message || bulkErr))
    for (let i = 0; i < parsedNotes.length; i++) {
      const n = parsedNotes[i]
      let retries = 3
      let success = false
      while (retries > 0 && !success) {
        try {
          const res = await sql`
            INSERT INTO notes (id, title, content, tags, created_at, updated_at)
            VALUES (${n.id}, ${n.title}, ${n.content}, ${serializeTags(n.tags)}, ${n.createdAt}, ${n.updatedAt})
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              tags = EXCLUDED.tags,
              updated_at = EXCLUDED.updated_at
            RETURNING (xmax <> 0) AS updated
          `
          const row = Array.isArray(res) ? res[0] : res?.[0]
          if (row?.updated) updatedCount++
          else importedCount++
          success = true
        } catch (dbError) {
          retries--
          if (retries === 0) throw dbError
          await sleep(1000)
        }
      }
      if (i + 1 < parsedNotes.length) await sleep(500)
    }
  }

  return { importedCount, updatedCount }
}

/** @param {any} sql */
export async function exportNotesBackup(sql) {
  const notes = await sql`
    SELECT id, title, content, tags, created_at, updated_at
    FROM notes
    ORDER BY created_at ASC
  `
  return {
    timestamp: new Date().toISOString(),
    version: '1.0',
    notes: notes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags ? JSON.parse(note.tags) : [],
      createdAt: note.created_at?.toISOString?.() || note.created_at,
      updatedAt: note.updated_at?.toISOString?.() || note.updated_at,
    })),
  }
}
