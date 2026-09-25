export interface CorsEnv {
  ALLOWED_ORIGINS?: string
}

export type CorsRequest =
  | Request
  | { headers?: { get?: (name: string) => string | null; origin?: string } }
  | string
  | null
  | undefined

export function parseAllowedOrigins(env?: CorsEnv | NodeJS.ProcessEnv): string[]
export function getRequestOrigin(input: CorsRequest): string
export function resolveCorsOrigin(
  request: CorsRequest,
  env?: CorsEnv | NodeJS.ProcessEnv
): string | null
export function buildCorsHeaders(
  request: CorsRequest,
  env?: CorsEnv | NodeJS.ProcessEnv,
  extra?: Record<string, string>
): Record<string, string>
export function preflightHeaders(
  request: CorsRequest,
  env?: CorsEnv | NodeJS.ProcessEnv,
  methods?: string
): Record<string, string>
export function setExpressCorsHeaders(
  req: import('express').Request,
  res: import('express').Response
): void
