export const SESSION_COOKIE = 'notes_session'
const DEFAULT_SESSION_TTL_SEC = 60 * 60 * 24 * 7

export function getSessionTtlSec(env?: { SESSION_TTL_SEC?: string }): number {
  const raw = env?.SESSION_TTL_SEC
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SESSION_TTL_SEC
}

export const SESSION_TTL_SEC = DEFAULT_SESSION_TTL_SEC

export function getJwtSecret(
  password: string,
  envJwtSecret?: string,
  isProduction = false
): string {
  if (envJwtSecret) return envJwtSecret
  if (isProduction) return ''
  return password || ''
}

function base64urlFromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlFromString(str: string): string {
  return base64urlFromBytes(new TextEncoder().encode(str))
}

function base64urlToString(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64urlFromBytes(new Uint8Array(sig))
}

interface SignOptions {
  ttlSec?: number
  pwdVer?: number
}

export async function signSessionToken(
  password: string,
  envJwtSecret?: string,
  options: SignOptions = {},
  isProduction = false
): Promise<string> {
  const secret = getJwtSecret(password, envJwtSecret, isProduction)
  const ttlSec = options.ttlSec ?? SESSION_TTL_SEC
  const pwdVer = options.pwdVer ?? 0
  const header = base64urlFromString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64urlFromString(
    JSON.stringify({ sub: 'notes', iat: now, exp: now + ttlSec, pwdVer })
  )
  const sig = await hmacSign(`${header}.${payload}`, secret)
  return `${header}.${payload}.${sig}`
}

interface VerifyOptions {
  expectedPwdVer?: number
}

export async function verifySessionToken(
  token: string,
  password: string,
  envJwtSecret?: string,
  options: VerifyOptions = {},
  isProduction = false
): Promise<boolean> {
  if (!token) return false
  const secret = getJwtSecret(password, envJwtSecret, isProduction)
  if (!secret) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [header, payload, signature] = parts
  const expected = await hmacSign(`${header}.${payload}`, secret)
  if (signature.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) return false
  try {
    const data = JSON.parse(base64urlToString(payload)) as { exp?: number; pwdVer?: number }
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return false
    if (options.expectedPwdVer !== undefined) {
      const tokenVer = data.pwdVer ?? 0
      if (tokenVer !== options.expectedPwdVer) return false
    }
    return true
  } catch {
    return false
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name) cookies[name] = decodeURIComponent(rest.join('='))
  }
  return cookies
}

export function buildSessionCookie(
  token: string,
  isProduction: boolean,
  ttlSec = SESSION_TTL_SEC
): string {
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

export function clearSessionCookie(isProduction: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=0']
  if (isProduction) parts.push('Secure')
  return parts.join('; ')
}

export async function extractAndVerifySession(
  request: Request,
  password: string,
  envJwtSecret?: string,
  expectedPwdVer = 0,
  isProduction = false
): Promise<boolean> {
  const cookies = parseCookies(request.headers.get('cookie'))
  const cookieToken = cookies[SESSION_COOKIE]
  const verifyOptions = { expectedPwdVer }
  if (
    cookieToken &&
    (await verifySessionToken(cookieToken, password, envJwtSecret, verifyOptions, isProduction))
  ) {
    return true
  }
  const auth = request.headers.get('Authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length)
    return verifySessionToken(token, password, envJwtSecret, verifyOptions, isProduction)
  }
  return false
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toUpperCase())
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}
