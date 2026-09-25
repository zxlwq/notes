import { neon } from '@neondatabase/serverless'
import { checkAuth, unauthorizedResponse } from '../../../_utils/auth.js'
import { apiCors, apiPreflight } from '../../../_utils/cors.js'
import { ensureSharesTable, listSharesByNoteId } from '../../../../shared/neon-shares.js'

export default async function onRequest(context) {
  const { request, env, params } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  if (method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  }

  const noteId = params?.id
  if (!noteId) {
    return new Response(JSON.stringify({ error: 'Note ID required' }), {
      status: 400,
      headers: apiCors(request, env),
    })
  }

  try {
    const sql = neon(env.DATABASE_URL)
    await ensureSharesTable(sql)
    const items = await listSharesByNoteId(sql, noteId)
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: apiCors(request, env),
    })
  } catch (e) {
    console.error('[SHARE] list failed:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
