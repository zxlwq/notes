import { logToD1 } from '../_utils/log'
import { checkAuth } from '../_utils/auth'
import { triggerPgSync } from '../_utils/pgSync'
import type { PagesFunction, D1Database } from '../types'
import { ensureNotesTable, importNotes } from '../../shared/d1-notes.js'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequestPost: PagesFunction<{
  NOTESD: D1Database
  PASSWORD?: string
}> = async (context) => {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'POST, OPTIONS'),
    })
  }

  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  try {
    await ensureNotesTable(env.NOTESD)
    const { notes } = await request.json()

    if (!notes || !Array.isArray(notes)) {
      await logToD1(env, 'warn', 'import.invalid_notes')
      return new Response(JSON.stringify({ error: 'Invalid notes data' }), {
        status: 400,
        headers: apiCors(request, env),
      })
    }

    const importedCount = await importNotes(env.NOTESD, notes)
    await logToD1(env, 'info', 'import.done', { imported: importedCount, total: notes.length })
    triggerPgSync(context)
    return Response.json(
      {
        success: true,
        imported: importedCount,
        total: notes.length,
      },
      { headers: apiCors(request, env) }
    )
  } catch (error) {
    console.error('Import API error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logToD1(env, 'error', 'import.exception', { message: errorMessage })
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
