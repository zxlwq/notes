const SESSION_TOKEN_KEY = 'notes_session_token'

let sessionToken: string | null = null

function readStoredToken(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY)
    return raw && raw.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token)
    else sessionStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // ignore
  }
}

sessionToken = readStoredToken()

export function setSessionToken(token: string | null): void {
  sessionToken = token
  writeStoredToken(token)
}

export function getSessionToken(): string | null {
  return sessionToken
}

export function clearSessionToken(): void {
  sessionToken = null
  writeStoredToken(null)
}
