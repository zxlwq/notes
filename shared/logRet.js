export const LOG_RETENTION_DAYS = Math.max(
  1,
  Number.parseInt(process.env.LOG_RETENTION_DAYS ?? '7', 10) || 7
)

/** 删除超过保留天数的日志，默认 7 天 */
export async function pruneOldLogs(pool, days = LOG_RETENTION_DAYS) {
  const result = await pool.query(
    `DELETE FROM logs WHERE created_at < NOW() - ($1::text || ' days')::interval`,
    [String(days)]
  )
  return result.rowCount ?? 0
}
