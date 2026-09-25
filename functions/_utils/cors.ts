import { buildCorsHeaders, preflightHeaders } from '../../shared/cors.js'

type CorsEnv = { ALLOWED_ORIGINS?: string; [key: string]: unknown }

export function apiCors(
  request: Request,
  env?: CorsEnv,
  extra: Record<string, string> = {}
): Record<string, string> {
  return buildCorsHeaders(request, env, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extra,
  })
}

export function apiPreflight(
  request: Request,
  env?: CorsEnv,
  methods = 'GET, POST, PUT, DELETE, OPTIONS'
): Record<string, string> {
  return preflightHeaders(request, env, methods)
}
