export interface RateLimitResult {
  allowed: boolean
  retryAfterSec: number
}

export function createRateLimiter(options?: {
  windowMs?: number
  max?: number
}): (key: string) => RateLimitResult

/** Express / Node request IP helper */
export function getRequestIp(req: {
  headers?: Record<string, string | string[] | undefined>
  ip?: string
  connection?: { remoteAddress?: string }
}): string

export function getFetchRequestIp(request: Request): string

export function rateLimitResponse(
  retryAfterSec: number | undefined,
  corsHeaders?: Record<string, string>
): Response
