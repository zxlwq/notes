import { neon } from '@neondatabase/serverless'

import { isDev } from './logger.js'

export function log(level, message, data = null, env = null) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level,
    message,
    data,
  }

  if (level === 'error' || isDev(env)) {
    const fn = level === 'error' ? console.error : console.warn
    fn(`[${level.toUpperCase()}] ${timestamp}: ${message}`, data ? data : '')
  }

  if (env && env.DATABASE_URL) {
    logToDatabase(env, level, message, data).catch((error) => {
      console.error('[LOG] Database save failed:', error)
    })
  }

  return logEntry
}

export function logInfo(message, data = null, env = null) {
  return log('info', message, data, env)
}

export function logError(message, data = null, env = null) {
  return log('error', message, data, env)
}

export function logWarn(message, data = null, env = null) {
  return log('warn', message, data, env)
}

export function logDebug(message, data = null, env = null) {
  return log('debug', message, data, env)
}

export async function logToDatabase(env, level, message, data = null) {
  if (!env || !env.DATABASE_URL) {
    if (level === 'error' || isDev(env)) {
      const fn = level === 'error' ? console.error : console.warn
      fn(`[${level.toUpperCase()}] ${new Date().toISOString()}: ${message}`, data ? data : '')
    }
    return
  }

  try {
    const sql = neon(env.DATABASE_URL)

    await sql`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    await sql`
      INSERT INTO logs (level, message, meta) 
      VALUES (${level}, ${message}, ${data ? JSON.stringify(data) : null})
    `

    if (isDev(env)) {
      console.warn(
        `[${level.toUpperCase()}] ${new Date().toISOString()}: ${message} (saved to Neon database)`
      )
    }
  } catch (error) {
    console.error('[LOG] Database logging failed:', error)
    if (level === 'error' || isDev(env)) {
      console.warn(
        `[${level.toUpperCase()}] ${new Date().toISOString()}: ${message}`,
        data ? data : ''
      )
    }
  }
}

export async function logBatchToDatabase(env, logs) {
  if (!env || !env.DATABASE_URL || !Array.isArray(logs)) {
    return
  }

  try {
    const sql = neon(env.DATABASE_URL)

    await sql`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        level TEXT,
        message TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    for (const log of logs) {
      await sql`
        INSERT INTO logs (level, message, meta) 
        VALUES (${log.level}, ${log.message}, ${log.data ? JSON.stringify(log.data) : null})
      `
    }

    if (isDev(env)) {
      console.warn(`[LOG] Batch logged ${logs.length} entries to Neon database`)
    }
  } catch (error) {
    console.error('[LOG] Batch database logging failed:', error)
  }
}
