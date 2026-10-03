import { neon } from '@neondatabase/serverless'
import { logError, logToDatabase } from '../_utils/log.js'
import { trace } from '../_utils/logger.js'
import { checkAuth, unauthorizedResponse } from '../_utils/auth.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'

export default async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  trace(env, '[IMPORT] Request method:', method)
  trace(env, '[IMPORT] Environment variables:', Object.keys(env || {}))

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env, 'POST, OPTIONS') })
  }

  if (method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  try {
    const body = await request.json()
    const { notes } = body

    if (!Array.isArray(notes)) {
      return new Response(JSON.stringify({ error: 'Notes must be an array' }), {
        status: 400,
        headers: apiCors(request, env),
      })
    }

    const sql = neon(env.DATABASE_URL)

    trace(env, '[IMPORT] Importing notes to Neon database, count:', notes.length)

    try {
      let importedCount = 0
      let errorCount = 0

      for (const note of notes) {
        try {
          await sql`
            INSERT INTO notes (id, title, content, tags, created_at, updated_at) 
            VALUES (${note.id}, ${note.title}, ${note.content}, ${JSON.stringify(note.tags || [])}, ${note.createdAt || new Date().toISOString()}, ${note.updatedAt || new Date().toISOString()})
            ON CONFLICT (id) DO UPDATE SET 
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              tags = EXCLUDED.tags,
              updated_at = EXCLUDED.updated_at
          `
          importedCount++
        } catch (noteError) {
          console.error('[IMPORT] Failed to import note:', note.id, noteError)
          logError('import:note:error', { id: note.id, message: noteError?.message }, env)
          errorCount++
        }
      }

      trace(env, '[IMPORT] Import completed:', { importedCount, errorCount })
      try {
        await logToDatabase(env, 'info', 'import:complete', {
          importedCount,
          errorCount,
          totalNotes: notes.length,
        })
      } catch {}
      return new Response(
        JSON.stringify({
          success: true,
          importedCount,
          errorCount,
          totalNotes: notes.length,
        }),
        {
          status: 200,
          headers: apiCors(request, env),
        }
      )
    } catch (dbError) {
      console.error('[IMPORT] Database import failed:', dbError)
      logError('import:error', { message: dbError?.message }, env)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database import failed',
          details: dbError.message,
        }),
        {
          status: 500,
          headers: apiCors(request, env),
        }
      )
    }
  } catch (error) {
    console.error('Import error:', error)
    logError('import:unhandled', { message: error?.message }, env)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
