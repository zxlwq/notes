import type { GistStore } from './gist.js'

export function createPgGistStore(pool: {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<{ value?: string }> }>
}): GistStore

export function createD1GistStore(db: {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first(): Promise<{ value?: string } | null>
      run(): Promise<unknown>
    }
  }
}): GistStore

export function createNeonGistStore(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>
): GistStore
