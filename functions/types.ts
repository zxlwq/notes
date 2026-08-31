export interface D1Database {
  prepare(query: string): D1PreparedStatement
  exec(query: string): Promise<D1ExecResult>
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}

export interface D1Result<T = unknown> {
  success: boolean
  meta: {
    duration: number
    rows_read: number
    rows_written: number
    last_row_id: number
    changed_db: boolean
    changes: number
  }
  results?: T[]
  error?: string
}

export interface D1ExecResult {
  count: number
  duration: number
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions
  ): Promise<R2Object>
  delete(keys: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
  head(key: string): Promise<R2Object | null>
}

export interface R2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  checksums: R2Checksums
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  body?: ReadableStream
  bodyUsed?: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  blob(): Promise<Blob>
}

export interface R2Checksums {
  md5?: ArrayBuffer
  sha1?: ArrayBuffer
  sha256?: ArrayBuffer
  sha384?: ArrayBuffer
  sha512?: ArrayBuffer
}

export interface R2HTTPMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

export interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  onlyIf?: R2Conditional
}

export interface R2Conditional {
  etagMatches?: string
  etagDoesNotMatch?: string
  uploadedBefore?: Date
  uploadedAfter?: Date
}

export interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
  include?: ('httpMetadata' | 'customMetadata')[]
}

export interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

export interface Ai {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>
}

export interface ServiceBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export interface PagesFunctionEnv {
  NOTESD?: D1Database
  NOTESR?: R2Bucket
  AI?: Ai
  PASSWORD?: string
  DATABASE_URL?: string
  JWT_SECRET?: string
  NODE_ENV?: string
  ALLOWED_ORIGINS?: string
  SESSION_TTL_SEC?: string
  LOG_RETENTION_DAYS?: string
  TOKEN?: string
  /** Pages → Worker Service Binding（变量名 LOG_CRON） */
  LOG_CRON?: ServiceBinding
  [key: string]: unknown
}

export type PagesFunction<TEnv extends PagesFunctionEnv = PagesFunctionEnv> = (
  context:
    | {
        request: Request
        env: TEnv
        waitUntil?: (promise: Promise<unknown>) => void
        passThroughOnException?: () => void
        next?: (input?: Request | string, init?: RequestInit) => Promise<Response>
        params?: Record<string, string | undefined>
        data?: unknown
      }
    | {
        request: Request
        env: TEnv
      }
) => Response | Promise<Response>
