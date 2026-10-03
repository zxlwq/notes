import crypto from 'node:crypto'

export const SESSION_COOKIE = 'notes_session'
const DEFAULT_SESSION_TTL_SEC = 60 * 60 * 24 * 7

export function getSessionTtlSec(env) {
  const raw =
    env?.SESSION_TTL_SEC ?? (typeof process !== 'undefined' ? process.env?.SESSION_TTL_SEC : '')
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SESSION_TTL_SEC
}

export const SESSION_TTL_SEC = getSessionTtlSec()

export function getJwtSecret(password) {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production') return ''
  return password || ''
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function parseSignOptions(options) {
  if (typeof options === 'number') {
    return { ttlSec: options, pwdVer: 0 }
  }
  return {
    ttlSec: options?.ttlSec ?? SESSION_TTL_SEC,
    pwdVer: options?.pwdVer ?? 0,
  }
}

function parseVerifyOptions(options) {
  if (options == null || typeof options !== 'object') {
    return { expectedPwdVer: undefined }
  }
  return { expectedPwdVer: options.expectedPwdVer }
}

export function signSessionToken(secret, options = {}) {
  const { ttlSec, pwdVer } = parseSignOptions(options)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(JSON.stringify({ sub: 'notes', iat: now, exp: now + ttlSec, pwdVer }))
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

export function verifySessionToken(token, secret, options = {}) {
  const { expectedPwdVer } = parseVerifyOptions(options)
  if (!token || typeof token !== 'string' || !secret) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [header, payload, signature] = parts
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')
  if (signature.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return false
    if (expectedPwdVer !== undefined) {
      const tokenVer = data.pwdVer ?? 0
      if (tokenVer !== expectedPwdVer) return false
    }
    return true
  } catch {
    return false
  }
}

export function parseCookies(cookieHeader) {
  const cookies = {}
  if (!cookieHeader) return cookies
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name) cookies[name] = decodeURIComponent(rest.join('='))
  }
  return cookies
}

export function buildSessionCookie(token, isProduction, ttlSec = SESSION_TTL_SEC) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${ttlSec}`,
  ]
  if (isProduction) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(isProduction) {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=0']
  if (isProduction) parts.push('Secure')
  return parts.join('; ')
}

export function extractSessionToken(req) {
  const cookies = parseCookies(req.headers?.cookie || '')
  if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE]

  const auth = req.headers?.authorization || ''
  if (auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length)
  }
  return null
}

export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export function generateRecoveryCode() {
  const bytes = crypto.randomBytes(16)
  const hex = bytes.toString('hex').toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}
