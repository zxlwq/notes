export const SQL = {
  CREATE_NOTES_TABLE: `
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `,

  SELECT_NOTE_SUMMARIES: `
    SELECT id, title, tags, created_at, updated_at, LENGTH(content) AS content_length
    FROM notes ORDER BY updated_at DESC
  `,

  SELECT_NOTE_SUMMARIES_PAGE: `
    SELECT id, title, tags, created_at, updated_at, LENGTH(content) AS content_length
    FROM notes ORDER BY updated_at DESC
    LIMIT $1 OFFSET $2
  `,

  COUNT_NOTES: `SELECT COUNT(*)::int AS total FROM notes`,

  SELECT_NOTES_WITH_CONTENT: `SELECT * FROM notes ORDER BY updated_at DESC`,

  SELECT_NOTE_BY_ID: `SELECT * FROM notes WHERE id = $1`,

  UPSERT_NOTE: `
    INSERT INTO notes (id, title, content, tags, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      tags = EXCLUDED.tags,
      updated_at = EXCLUDED.updated_at
  `,

  UPDATE_NOTE: `
    UPDATE notes SET title = $1, content = $2, tags = $3, updated_at = $4 WHERE id = $5
  `,

  DELETE_NOTE: `DELETE FROM notes WHERE id = $1`,

  DELETE_ALL_NOTES: `DELETE FROM notes`,
}
