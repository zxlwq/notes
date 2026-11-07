import type { PagesFunction } from '../types'
import { clearSessionCookie } from '../_utils/session'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env, 'POST, OPTIONS'),
    })
  }

  const isProduction = env.NODE_ENV === 'production'
  return Response.json(
    { success: true },
    {
      headers: apiCors(request, env, {
        'Set-Cookie': clearSessionCookie(isProduction),
      }),
    }
  )
}
