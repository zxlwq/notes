import { neon } from '@neondatabase/serverless'
import { checkAuth, unauthorizedResponse } from '../../_utils/auth.js'
import { apiCors, apiPreflight } from '../../_utils/cors.js'
import { logError, logToDatabase } from '../../_utils/log.js'
import { trace } from '../../_utils/logger.js'
import { getNoteById, updateNote, deleteNote } from '../../../shared/neon-notes.js'

export default async function onRequest(context) {
  const { request, params, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  try {
    const noteId = params.id
    const sql = neon(env.DATABASE_URL)

    if (method === 'GET') {
      trace(env, '[NOTE] Getting note from Neon database:', noteId)

      try {
        const formattedNote = await getNoteById(sql, noteId)
        if (!formattedNote) {
          return new Response(JSON.stringify({ error: 'Note not found' }), {
            status: 404,
            headers: apiCors(request, env),
          })
        }

        trace(env, '[NOTE] Note found in Neon database:', formattedNote.id)
        try {
          await logToDatabase(env, 'info', 'note:get:success', { id: formattedNote.id })
        } catch {}
        return new Response(JSON.stringify(formattedNote), {
          status: 200,
          headers: apiCors(request, env),
        })
      } catch (dbError) {
        console.error('[NOTE] Database query failed:', dbError)
        logError('note:get:error', { id: noteId, message: dbError?.message }, env)
        return new Response(JSON.stringify({ error: 'Database query failed' }), {
          status: 500,
          headers: apiCors(request, env),
        })
      }
    }

    if (method === 'PUT') {
      const body = await request.json()
      const { title, content, tags } = body

      trace(env, '[NOTE] Updating note in Neon database:', noteId)

      try {
        await updateNote(sql, noteId, { title, content, tags })
        trace(env, '[NOTE] Note updated in Neon database successfully')
        try {
          await logToDatabase(env, 'info', 'note:put:success', { id: noteId })
        } catch {}
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: apiCors(request, env),
        })
      } catch (dbError) {
        console.error('[NOTE] Database update failed:', dbError)
        logError('note:put:error', { id: noteId, message: dbError?.message }, env)
        return new Response(JSON.stringify({ error: 'Database update failed' }), {
          status: 500,
          headers: apiCors(request, env),
        })
      }
    }

    if (method === 'DELETE') {
      trace(env, '[NOTE] Deleting note from Neon database:', noteId)

      try {
        await deleteNote(sql, noteId)
        trace(env, '[NOTE] Note deleted from Neon database successfully')
        try {
          await logToDatabase(env, 'info', 'note:delete:success', { id: noteId })
        } catch {}
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: apiCors(request, env),
        })
      } catch (dbError) {
        console.error('[NOTE] Database delete failed:', dbError)
        logError('note:delete:error', { id: noteId, message: dbError?.message }, env)
        return new Response(JSON.stringify({ error: 'Database delete failed' }), {
          status: 500,
          headers: apiCors(request, env),
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  } catch (error) {
    console.error('Note operation error:', error)
    logError('note:unhandled', { message: error?.message }, env)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
