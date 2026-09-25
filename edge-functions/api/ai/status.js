import { checkAuth, unauthorizedResponse } from '../../_utils/auth.js'
import { apiCors, apiPreflight } from '../../_utils/cors.js'
import { getAiStatus } from '../../../shared/ai/handlers.js'

export default async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: apiPreflight(request, env, 'GET, OPTIONS') })
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  return new Response(JSON.stringify(getAiStatus(env, { aiBinding: env.AI })), {
    status: 200,
    headers: apiCors(request, env),
  })
}
