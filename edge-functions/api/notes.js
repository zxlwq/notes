import { neon } from '@neondatabase/serverless'
import { checkAuth, unauthorizedResponse } from '../_utils/auth.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'
import { logError, logToDatabase } from '../_utils/log.js'
import { trace } from '../_utils/logger.js'
import { parsePageLimit } from '../../shared/pagination.js'
import {
  ensureNotesTable,
  listNoteSummaries,
  listNoteSummariesPage,
  upsertNote,
} from '../../shared/neon-notes.js'

export default async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  try {
    const sql = neon(env.DATABASE_URL)
    await ensureNotesTable(sql)

    if (method === 'GET') {
      trace(env, '[NOTES] Getting notes from Neon database')
      const url = new URL(request.url)
      const paginated = url.searchParams.has('page') || url.searchParams.has('limit')

      try {
        if (paginated) {
          const { page, limit } = parsePageLimit({
            page: url.searchParams.get('page') ?? undefined,
            limit: url.searchParams.get('limit') ?? undefined,
          })
          const body = await listNoteSummariesPage(sql, page, limit)
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: apiCors(request, env),
          })
        }

        const formattedNotes = await listNoteSummaries(sql)
        trace(env, '[NOTES] Database connection successful, notes count:', formattedNotes.length)
        try {
          await logToDatabase(env, 'info', 'notes:get:success', { count: formattedNotes.length })
        } catch {}
        return new Response(JSON.stringify(formattedNotes), {
          status: 200,
          headers: apiCors(request, env),
        })
      } catch (dbError) {
        console.error('[NOTES] Database query failed:', dbError)
        logError('notes:get:error', { message: dbError?.message }, env)
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: apiCors(request, env),
        })
      }
    }

    if (method === 'POST') {
      trace(env, '[NOTES] Creating note in Neon database')
      const body = await request.json()
      const { id, title, content, tags, createdAt } = body

      if (!id || !title || !content) {
        return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
          status: 400,
          headers: apiCors(request, env),
        })
      }

      try {
        const noteId = await upsertNote(sql, {
          id,
          title,
          content,
          tags,
          createdAt: createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        trace(env, '[NOTES] Note saved to Neon database successfully')
        try {
          await logToDatabase(env, 'info', 'notes:post:success', { id: noteId })
        } catch {}
        return new Response(JSON.stringify({ success: true, id: noteId }), {
          status: 200,
          headers: apiCors(request, env),
        })
      } catch (dbError) {
        console.error('[NOTES] Database save failed:', dbError)
        logError('notes:post:error', { message: dbError?.message }, env)
        return new Response(JSON.stringify({ success: false, error: 'Database save failed' }), {
          status: 500,
          headers: apiCors(request, env),
        })
      }
    }

    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  } catch (error) {
    console.error('[NOTES] Error:', error)
    logError('notes:unhandled', { message: error?.message }, env)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: error.message }),
      { status: 500, headers: apiCors(request, env) }
    )
  }
}
