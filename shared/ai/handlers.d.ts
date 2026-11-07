export function getAiStatus(
  env: Record<string, unknown>,
  options?: { aiBinding?: unknown }
): {
  enabled: boolean
  provider: string | null
  model: string | null
  models: string[]
  providers: Array<{
    id: string
    model: string
    models: string[]
    cfMode?: 'binding' | 'rest'
  }>
  cfMode?: 'binding' | 'rest'
  limits: {
    maxInputChars: number
    rateLimitMax: number
    rateLimitWindowSec: number
  }
}

export function checkAiRateLimit(
  ip: string,
  env: Record<string, unknown>
): { allowed: boolean; retryAfterSec: number }

export function handleAiComplete(
  env: Record<string, unknown>,
  body: unknown,
  ip: string,
  logFn?: (level: string, message: string, meta?: object) => Promise<void> | void,
  options?: { aiBinding?: unknown }
): Promise<{
  status: number
  headers?: Record<string, string>
  body: Record<string, unknown>
}>
