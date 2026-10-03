import { checkAuth } from '../../../_utils/auth'
import type { PagesFunction } from '../../../types'
import { ensureSharesTable, listSharesByNoteId } from '../../../../shared/d1-shares.js'
import { apiCors, apiPreflight } from '../../../_utils/cors'

const extractNoteId = (request: Request): string | null => {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean)
  // /api/notes/:id/shares
  return parts.length >= 4 && parts[0] === 'api' && parts[1] === 'notes' && parts[3] === 'shares'
    ? parts[2]
    : null
}

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (method !== 'GET') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: apiCors(request, env) }
    )
  }

  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  const noteId = extractNoteId(request)
  if (!noteId) {
    return Response.json(
      { error: 'Note ID required' },
      { status: 400, headers: apiCors(request, env) }
    )
  }

  try {
    await ensureSharesTable(env.NOTESD!)
    const items = await listSharesByNoteId(env.NOTESD!, noteId)
    return Response.json({ items }, { headers: apiCors(request, env) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500, headers: apiCors(request, env) })
  }
}
