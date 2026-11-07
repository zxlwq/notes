export const DEFAULT_LOG_RETENTION_DAYS = 7

/** 删除 D1 logs 表中超过保留天数的记录 */
export async function pruneOldLogsD1(db, days = DEFAULT_LOG_RETENTION_DAYS) {
  const safeDays = Math.max(1, Number.parseInt(String(days), 10) || DEFAULT_LOG_RETENTION_DAYS)
  const result = await db
    .prepare(`DELETE FROM logs WHERE datetime(created_at) < datetime('now', ?)`)
    .bind(`-${safeDays} days`)
    .run()
  return result.meta?.changes ?? 0
}
