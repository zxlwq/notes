import { checkAuth } from '../../_utils/auth'
import type { PagesFunction } from '../../types'
import { apiCors, apiPreflight } from '../../_utils/cors'
import { getAiStatus } from '../../../shared/ai/handlers.js'

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'GET, OPTIONS'),
    })
  }

  if (!(await checkAuth(request, env))) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: apiCors(request, env) }
    )
  }

  return Response.json(getAiStatus(env, { aiBinding: env.AI }), { headers: apiCors(request, env) })
}
