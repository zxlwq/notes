export const D1_MIGRATIONS: Array<{ version: number; name: string; sql: string }>
export const D1_INDEX_SQL: string[]

export function runD1Migrations(db: {
  prepare(query: string): {
    bind(...values: unknown[]): { first(): Promise<unknown>; run(): Promise<unknown> }
    run(): Promise<unknown>
  }
}): Promise<void>
