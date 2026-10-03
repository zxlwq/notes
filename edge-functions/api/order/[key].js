import { neon } from '@neondatabase/serverless'
import { checkAuth, unauthorizedResponse } from '../../_utils/auth.js'
import { apiCors, apiPreflight } from '../../_utils/cors.js'
import { logError } from '../../_utils/log.js'

export default async function onRequest(context) {
  const { request, params, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'GET, POST, OPTIONS'),
    })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  try {
    const sql = neon(env.DATABASE_URL)
    const key = params?.key

    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'Key is required' }), {
        status: 400,
        headers: apiCors(request, env),
      })
    }

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
      CREATE TABLE IF NOT EXISTS order_data (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    if (request.method === 'GET') {
      const result = await sql`
        SELECT value FROM order_data WHERE key = ${key}
      `

      if (result.length === 0) {
        return new Response(JSON.stringify({ success: true, data: null }), {
          status: 200,
          headers: apiCors(request, env),
        })
      }

      const value = result[0].value
      let parsed = null
      try {
        parsed = value ? JSON.parse(value) : null
      } catch {
        parsed = value
      }

      return new Response(JSON.stringify({ success: true, data: parsed }), {
        status: 200,
        headers: apiCors(request, env),
      })
    }

    if (request.method === 'POST') {
      const value = await request.json()

      if (typeof value === 'undefined') {
        return new Response(JSON.stringify({ success: false, error: 'Value is required' }), {
          status: 400,
          headers: apiCors(request, env),
        })
      }

      const valueStr = JSON.stringify(value)

      await sql`
        INSERT INTO order_data (key, value, updated_at) 
        VALUES (${key}, ${valueStr}, ${new Date().toISOString()})
        ON CONFLICT (key) DO UPDATE SET 
          value = EXCLUDED.value, 
          updated_at = EXCLUDED.updated_at
      `

      try {
        await sql`
          INSERT INTO logs (level, message, meta) 
          VALUES ('info', ${`Order data saved: ${key}`}, ${JSON.stringify({ key })})
        `
      } catch (e) {
        console.error('Failed to log order save:', e)
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: apiCors(request, env),
      })
    }

    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  } catch (error) {
    console.error('[ORDER] Error:', error)
    logError('order:unhandled', { message: error?.message }, env)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: apiCors(request, env),
      }
    )
  }
}
