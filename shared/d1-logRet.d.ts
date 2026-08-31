export const DEFAULT_LOG_RETENTION_DAYS: number

export function pruneOldLogsD1(
  db: {
    prepare(query: string): {
      bind(...values: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> }
    }
  },
  days?: number
): Promise<number>
