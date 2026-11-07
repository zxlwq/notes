import { neon } from '@neondatabase/serverless'
import { checkAuth, unauthorizedResponse } from '../_utils/auth.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'
import { trace } from '../_utils/logger.js'

export default async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  trace(env, '[LOGS] Request method:', method)
  trace(env, '[LOGS] Environment variables:', Object.keys(env || {}))

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'GET, DELETE, OPTIONS'),
    })
  }

  if (method !== 'GET' && method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  try {
    const sql = neon(env.DATABASE_URL)

    if (method === 'DELETE') {
      trace(env, '[LOGS] Clearing logs table')
      try {
        await sql`DELETE FROM logs`
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: apiCors(request, env),
        })
      } catch (dbError) {
        console.error('[LOGS] Database clear failed:', dbError)
        return new Response(JSON.stringify({ success: false, error: 'Database clear failed' }), {
          status: 500,
          headers: apiCors(request, env),
        })
      }
    }

    trace(env, '[LOGS] Getting logs from Neon database')
    try {
      const logs = await sql`
        SELECT id, level, message, meta, created_at 
        FROM logs 
        ORDER BY created_at DESC 
        LIMIT 100
      `

      const items = logs.map((log) => ({
        id: log.id,
        level: log.level,
        message: log.message,
        meta: log.meta ?? null,
        created_at: (log.created_at instanceof Date
          ? log.created_at
          : new Date(log.created_at)
        ).toISOString(),
      }))

      trace(env, '[LOGS] Database connection successful, logs count:', items.length)
      return new Response(JSON.stringify({ items, total: items.length }), {
        status: 200,
        headers: apiCors(request, env),
      })
    } catch (dbError) {
      console.error('[LOGS] Database query failed:', dbError)
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: apiCors(request, env),
      })
    }
  } catch (error) {
    console.error('Logs error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
