import { checkAuth, unauthorizedResponse } from '../../_utils/auth.js'
import { apiCors, apiPreflight } from '../../_utils/cors.js'
import { logToDatabase } from '../../_utils/log.js'
import { getFetchRequestIp } from '../../../shared/rateLimit.js'
import { handleAiComplete } from '../../../shared/ai/handlers.js'

export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: apiPreflight(request, env, 'POST, OPTIONS') })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: '请求体无效' }), {
      status: 400,
      headers: apiCors(request, env),
    })
  }

  const ip = getFetchRequestIp(request)
  const result = await handleAiComplete(
    env,
    body,
    ip,
    (level, message, meta) => logToDatabase(env, level, message, meta),
    { aiBinding: env.AI }
  )

  const headers = {
    ...apiCors(request, env),
    ...(result.headers || {}),
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers,
  })
}
