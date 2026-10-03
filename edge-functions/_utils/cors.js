import { buildCorsHeaders, preflightHeaders } from '../../shared/cors.js'

export { buildCorsHeaders, preflightHeaders, resolveCorsOrigin } from '../../shared/cors.js'

export function apiCors(request, env, extra = {}) {
  return buildCorsHeaders(request, env, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extra,
  })
}

export function apiPreflight(request, env, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  return preflightHeaders(request, env, methods)
}
