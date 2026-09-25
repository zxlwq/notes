/** @typedef {{ ALLOWED_ORIGINS?: string }} CorsEnv */

/**
 * @param {CorsEnv | Record<string, string | undefined> | undefined} env
 */
export function parseAllowedOrigins(env) {
  const raw =
    (env && 'ALLOWED_ORIGINS' in env && env.ALLOWED_ORIGINS) ||
    (typeof process !== 'undefined' && process.env?.ALLOWED_ORIGINS) ||
    ''
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {Request | { headers?: { get?: (name: string) => string | null; origin?: string } } | string | null | undefined} input
 */
export function getRequestOrigin(input) {
  if (!input) return ''
  if (typeof input === 'string') return input
  if (typeof input.headers?.get === 'function') {
    return input.headers.get('origin') || ''
  }
  const headers = input.headers
  if (headers && typeof headers === 'object' && 'origin' in headers && headers.origin) {
    return String(headers.origin)
  }
  return ''
}

/**
 * @param {Request | { headers?: { get?: (name: string) => string | null; origin?: string } } | string | null | undefined} request
 * @param {CorsEnv | Record<string, string | undefined> | undefined} [env]
 */
export function resolveCorsOrigin(request, env) {
  const allowed = parseAllowedOrigins(env)
  const origin = getRequestOrigin(request)
  if (allowed.length > 0) {
    if (origin && allowed.includes(origin)) return origin
    return null
  }
  if (origin) return origin
  return '*'
}

/**
 * @param {Request | { headers?: { get?: (name: string) => string | null; origin?: string } } | string | null | undefined} request
 * @param {CorsEnv | Record<string, string | undefined> | undefined} [env]
 * @param {Record<string, string>} [extra]
 */
export function buildCorsHeaders(request, env, extra = {}) {
  const resolved = resolveCorsOrigin(request, env)
  /** @type {Record<string, string>} */
  const headers = { ...extra }
  if (resolved) {
    headers['Access-Control-Allow-Origin'] = resolved
    if (resolved !== '*') {
      headers['Vary'] = 'Origin'
      headers['Access-Control-Allow-Credentials'] = 'true'
    }
  }
  return headers
}

/**
 * @param {Request | { headers?: { get?: (name: string) => string | null; origin?: string } } | string | null | undefined} request
 * @param {CorsEnv | Record<string, string | undefined> | undefined} [env]
 * @param {string} [methods]
 */
export function preflightHeaders(request, env, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  return {
    ...buildCorsHeaders(request, env),
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function setExpressCorsHeaders(req, res) {
  const headers = buildCorsHeaders(req, process.env)
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}
