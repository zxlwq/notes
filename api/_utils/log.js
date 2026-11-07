import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export async function logToPostgreSQL(level, message, meta = null) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs(created_at)
    `)

    const metaJson = meta ? JSON.stringify(meta) : null
    await pool.query(
      `INSERT INTO logs(level, message, meta, created_at) VALUES($1, $2, $3, NOW())`,
      [level, message, metaJson]
    )
  } catch (e) {
    console.error('logToPostgreSQL error:', e)
  }
}

export async function logToD1(env, level, message, meta = null) {
  await logToPostgreSQL(level, message, meta)
}
