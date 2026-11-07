import { neon } from '@neondatabase/serverless'
import { checkAuth, unauthorizedResponse } from '../_utils/auth.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'
import { ensureSharesTable, createShare } from '../../shared/neon-shares.js'
import { normalizeCreateShareBody } from '../../shared/shares.js'

export default async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
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
    const sql = neon(env.DATABASE_URL)
    await ensureSharesTable(sql)
    const body = (await request.json()) || {}
    const normalized = normalizeCreateShareBody(body)
    if (normalized.error) {
      return new Response(JSON.stringify({ error: normalized.error }), {
        status: 400,
        headers: apiCors(request, env),
      })
    }

    const share = await createShare(sql, {
      noteId: normalized.noteId,
      title: normalized.title,
      content: normalized.content,
      tagsJson: normalized.tagsJson,
      expiresAt: normalized.expiresAt,
    })

    return new Response(
      JSON.stringify({
        success: true,
        token: share.token,
        urlPath: `/s/${share.token}`,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
      }),
      { status: 200, headers: apiCors(request, env) }
    )
  } catch (e) {
    console.error('[SHARE] create failed:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
