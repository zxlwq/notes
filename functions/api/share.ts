import { checkAuth } from '../_utils/auth'
import { triggerPgSync } from '../_utils/pgSync'
import type { PagesFunction } from '../types'
import { ensureSharesTable, createShare } from '../../shared/d1-shares.js'
import { normalizeCreateShareBody } from '../../shared/shares.js'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: apiCors(request, env) }
    )
  }

  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  try {
    await ensureSharesTable(env.NOTESD!)
    const body = (await request.json()) || {}
    const normalized = normalizeCreateShareBody(body)
    if (
      normalized.error ||
      !normalized.noteId ||
      normalized.title == null ||
      normalized.content == null
    ) {
      return Response.json(
        { error: normalized.error || 'Invalid share payload' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const share = await createShare(env.NOTESD!, {
      noteId: normalized.noteId,
      title: normalized.title,
      content: normalized.content,
      tagsJson: normalized.tagsJson ?? '[]',
      expiresAt: normalized.expiresAt ?? null,
    })
    triggerPgSync(context)
    return Response.json(
      {
        success: true,
        token: share.token,
        urlPath: `/s/${share.token}`,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
      },
      { headers: apiCors(request, env) }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500, headers: apiCors(request, env) })
  }
}
