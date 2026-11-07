import { clearSessionCookie } from '../_utils/session.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'

export default function onRequest(context) {
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

  const isProduction = env.NODE_ENV === 'production'
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      ...apiCors(request, env),
      'Set-Cookie': clearSessionCookie(isProduction),
    },
  })
}
