/** PostgreSQL / Neon pool gist_id 存储 */
export function createPgGistStore(pool) {
  return {
    async getGistId() {
      try {
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['gist_id'])
        return result.rows[0]?.value ?? null
      } catch {
        return null
      }
    },
    async saveGistId(gistId) {
      try {
        await pool.query(
          'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
          ['gist_id', gistId, new Date().toISOString()]
        )
      } catch (e) {
        console.error('保存 Gist ID 失败:', e)
      }
    },
    async clearGistId() {
      try {
        await pool.query('DELETE FROM settings WHERE key = $1', ['gist_id'])
      } catch (e) {
        console.error('清除 Gist ID 失败:', e)
      }
    },
  }
}

/** Cloudflare D1 gist_id 存储 */
export function createD1GistStore(db) {
  return {
    async getGistId() {
      try {
        const row = await db
          .prepare('SELECT value FROM settings WHERE key = ?')
          .bind('gist_id')
          .first()
        return row?.value ?? null
      } catch {
        return null
      }
    },
    async saveGistId(gistId) {
      try {
        const now = new Date().toISOString()
        await db
          .prepare(
            'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = ?'
          )
          .bind('gist_id', gistId, now, gistId, now)
          .run()
      } catch (e) {
        console.error('Failed to save Gist ID:', e)
      }
    },
    async clearGistId() {
      try {
        await db.prepare('DELETE FROM settings WHERE key = ?').bind('gist_id').run()
      } catch (e) {
        console.error('Failed to clear Gist ID:', e)
      }
    },
  }
}

/** Neon serverless tagged-template gist_id 存储 */
export function createNeonGistStore(sql) {
  return {
    async getGistId() {
      try {
        const result = await sql`SELECT value FROM settings WHERE key = 'gist_id'`
        return result.length > 0 ? result[0].value : null
      } catch {
        return null
      }
    },
    async saveGistId(gistId) {
      try {
        await sql`
          INSERT INTO settings (key, value, updated_at)
          VALUES ('gist_id', ${gistId}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = ${gistId}, updated_at = NOW()
        `
      } catch (e) {
        console.error('Failed to save Gist ID:', e)
      }
    },
    async clearGistId() {
      try {
        await sql`DELETE FROM settings WHERE key = 'gist_id'`
      } catch (e) {
        console.error('Failed to clear Gist ID:', e)
      }
    },
  }
}
