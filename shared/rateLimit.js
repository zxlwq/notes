const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX = 10

/** 进程内滑动窗口限流；多实例不共享。高流量可接 Redis 或 Cloudflare Rate Limiting。 */
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

export function getRequestIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip']
  if (forwarded) {
    return String(forwarded).split(',')[0].trim()
  }
  if (req.ip) return String(req.ip)
  if (req.connection?.remoteAddress) return String(req.connection.remoteAddress)
  return 'unknown'
}

export function getFetchRequestIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function rateLimitResponse(retryAfterSec, corsHeaders = {}) {
  return new Response(JSON.stringify({ success: false, error: '请求过于频繁，请稍后再试' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
      ...corsHeaders,
    },
  })
}
