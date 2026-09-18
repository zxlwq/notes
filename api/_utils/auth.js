import {
  checkAuth as checkAuthWithVersion,
  setCorsHeaders,
  unauthorizedJson,
} from '../../shared/auth-node.js'
import { getPasswordVersion } from '../../shared/credentials.js'

const PASSWORD = process.env.PASSWORD || ''

export { setCorsHeaders, unauthorizedJson }

export async function checkAuth(req, pool) {
  const pwdVer = await getPasswordVersion(pool)
  return checkAuthWithVersion(req, PASSWORD, pwdVer)
}

export { PASSWORD }
