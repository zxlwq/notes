export const D1_NOW = "strftime('%Y-%m-%dT%H:%M:%S','now','+8 hours')"

export const D1_SQL = {
  CREATE_NOTES_TABLE: `
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      tags TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `,

  SELECT_NOTE_SUMMARIES: `
    SELECT id, title, tags, created_at, updated_at, length(content) AS content_length
    FROM notes ORDER BY updated_at DESC
  `,

  SELECT_NOTE_SUMMARIES_PAGE: `
    SELECT id, title, tags, created_at, updated_at, length(content) AS content_length
    FROM notes ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `,

  COUNT_NOTES: `SELECT COUNT(*) AS total FROM notes`,

  SELECT_NOTE_BY_ID: `
    SELECT id, title, content, tags, created_at, updated_at FROM notes WHERE id = ?
  `,

  NOTE_EXISTS: `SELECT id FROM notes WHERE id = ?`,

  UPSERT_DEFAULT_NOTE: `
    INSERT INTO notes (id, title, content, created_at, updated_at)
    VALUES ('1', '默认笔记', ?, ${D1_NOW}, ${D1_NOW})
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      updated_at = ${D1_NOW}
  `,

  INSERT_NOTE: `
    INSERT INTO notes (id, title, content, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ${D1_NOW}, ${D1_NOW})
  `,

  UPSERT_NOTE: `
    INSERT INTO notes (id, title, content, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      tags = excluded.tags,
      updated_at = excluded.updated_at
  `,

  UPDATE_NOTE: `
    UPDATE notes SET title = ?, content = ?, tags = ?, updated_at = ${D1_NOW} WHERE id = ?
  `,

  DELETE_NOTE: `DELETE FROM notes WHERE id = ?`,

  DELETE_ALL_NOTES: `DELETE FROM notes`,
}
