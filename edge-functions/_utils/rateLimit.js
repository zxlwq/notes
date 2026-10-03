const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX = 10

export function createRateLimiter({ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX } = {}) {
  const hits = new Map()

  return (key) => {
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 })
      return { allowed: true, retryAfterSec: 0 }
    }

    entry.count += 1
    if (entry.count > max) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((entry.start + windowMs - now) / 1000),
      }
    }

    return { allowed: true, retryAfterSec: 0 }
  }
}

export function getFetchRequestIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
