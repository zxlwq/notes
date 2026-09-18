export interface PgQueryable {
  query(text: string, params?: unknown[]): Promise<unknown>
}

export interface D1PgSnapshot {
  notes?: Array<Record<string, string | null>>
  settings?: Array<Record<string, string | null>>
  orderData?: Array<Record<string, string | null>>
}

export function normalizePgTimestamp(value: unknown): string
export function ensurePgSchema(pool: PgQueryable): Promise<void>
export function syncD1SnapshotToPg(
  pool: PgQueryable,
  snapshot: D1PgSnapshot
): Promise<{ notes: number; settings: number; orderData: number }>
