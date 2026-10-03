import { checkAuth } from '../../_utils/auth'
import { logToD1 } from '../../_utils/log'
import type { PagesFunction } from '../../types'
import { apiCors, apiPreflight } from '../../_utils/cors'
import { getFetchRequestIp } from '../../_utils/rateLimit'
import { handleAiComplete } from '../../../shared/ai/handlers.js'

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'POST, OPTIONS'),
    })
  }

  if (!(await checkAuth(request, env))) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: apiCors(request, env) }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { success: false, error: '请求体无效' },
      { status: 400, headers: apiCors(request, env) }
    )
  }

  const ip = getFetchRequestIp(request)
  const result = await handleAiComplete(
    env,
    body,
    ip,
    (level, message, meta) => logToD1(env, level, message, meta),
    { aiBinding: env.AI }
  )

  const headers = {
    ...apiCors(request, env),
    ...(result.headers || {}),
  }

  return Response.json(result.body, { status: result.status, headers })
}
