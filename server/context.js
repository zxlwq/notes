import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'
import { checkAuth } from '../shared/auth-node.js'
import { getPasswordVersion } from '../shared/credentials.js'
import { listNoteSummaries, listNotesWithContent } from '../shared/pg-notes.js'
import { runMigrations } from '../shared/migrate.js'
import { pruneOldLogs } from '../shared/logRet.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const distDir = path.resolve(__dirname, '..', 'dist')

export const PORT = process.env.PORT || 3000
export const PASSWORD = process.env.PASSWORD || ''
export const WEBDAV_URL = process.env.WEBDAV_URL || ''
export const WEBDAV_USER = process.env.WEBDAV_USER || ''
export const WEBDAV_PASS = process.env.WEBDAV_PASS || ''
export const GIT_TOKEN = process.env.GIT_TOKEN || ''
export const ACCOUNT_ID = process.env.ACCOUNT_ID || ''
export const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID || ''
export const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY || ''

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[服务器] 错误: DATABASE_URL 环境变量未设置')
  process.exit(1)
}

if (!PASSWORD) {
  console.error('[服务器] 错误: PASSWORD 环境变量未设置')
  process.exit(1)
}

export const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.JWT_SECRET) {
  console.error('[服务器] 错误: 生产环境必须设置 JWT_SECRET')
  process.exit(1)
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    DATABASE_URL.includes('neon.tech') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
})

export async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT NOT NULL,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_data (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.warn('[服务器] 数据库表已初始化')
    await runMigrations(pool)
    const pruned = await pruneOldLogs(pool)
    if (pruned > 0) {
      console.warn(`[服务器] 已清理 ${pruned} 条过期日志`)
    }
  } catch (e) {
    console.error('[服务器] 数据库初始化失败:', e)
    throw e
  }
}

export async function getEffectivePassword() {
  try {
    const [pwdRow, flagRow] = await Promise.all([
      pool.query('SELECT value FROM settings WHERE key = $1', ['password']),
      pool.query('SELECT value FROM settings WHERE key = $1', ['password_set']),
    ])
    if (flagRow.rows[0]?.value === 'true' && pwdRow.rows[0]?.value) {
      return pwdRow.rows[0].value
    }
  } catch {
    // fall through
  }
  return PASSWORD
}

export async function authMiddleware(req, res, next) {
  const pwdVer = await getPasswordVersion(pool)
  if (!checkAuth(req, PASSWORD, pwdVer)) {
    return res.status(401).json({ success: false, error: '未授权' })
  }
  next()
}

export function cleanIP(ip) {
  if (!ip) return 'unknown'
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7)
  }
  return ip
}

export async function appendLog(level, message, meta) {
  const entry = {
    level,
    message,
    meta: meta ? JSON.stringify(meta) : null,
  }

  const levelMap = {
    info: '信息',
    warn: '警告',
    warning: '警告',
    error: '错误',
    debug: '调试',
  }
  const levelZh = levelMap[level] || level

  try {
    await pool.query('INSERT INTO logs (level, message, meta) VALUES ($1, $2, $3)', [
      level,
      message,
      entry.meta,
    ])
    console.warn(`[${levelZh}] ${message}`, meta ? JSON.stringify(meta) : '')
  } catch (e) {
    console.error('写入PostgreSQL日志失败:', e)
    console.warn(`[${levelZh}] ${message}`, meta ? JSON.stringify(meta) : '')
  }
}

export async function getAllNotes() {
  try {
    return await listNoteSummaries(pool)
  } catch (e) {
    console.error('获取笔记失败:', e)
    return []
  }
}

export async function getAllNotesWithContent() {
  try {
    return await listNotesWithContent(pool)
  } catch (e) {
    console.error('获取笔记失败:', e)
    return []
  }
}
