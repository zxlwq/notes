import { SESSION_COOKIE, getJwtSecret, verifySessionToken, parseCookies } from './session.js'
import { setExpressCorsHeaders } from './cors.js'

export function checkAuth(req, password, expectedPwdVer = 0) {
  const secret = getJwtSecret(password)
  if (!secret) return false
  const cookies = parseCookies(req.headers?.cookie || '')
  const cookieToken = cookies[SESSION_COOKIE]
  const verifyOptions = { expectedPwdVer }
  if (cookieToken && verifySessionToken(cookieToken, secret, verifyOptions)) return true

  const auth = req.headers?.authorization || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length)
    return verifySessionToken(token, secret, verifyOptions)
  }
  return false
}

export function setCorsHeaders(req, res) {
  setExpressCorsHeaders(req, res)
}

export function unauthorizedJson(res, message = 'Unauthorized') {
  return res.status(401).json({ success: false, error: message })
}
