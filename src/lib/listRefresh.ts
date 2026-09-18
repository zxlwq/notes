import type { AppSettings } from '@/types'

const INTERVAL_MS: Record<string, number> = {
  关闭: 0,
  '1分钟': 60_000,
  '5分钟': 300_000,
  '15分钟': 900_000,
}

export const LIST_REFRESH_OPTIONS = ['关闭', '1分钟', '5分钟', '15分钟'] as const

export function readListRefreshIntervalMs(): number {
  try {
    const saved = localStorage.getItem('app-settings')
    if (!saved) return INTERVAL_MS['5分钟']
    const parsed = JSON.parse(saved) as Partial<AppSettings>
    const key = parsed.listRefreshInterval ?? '5分钟'
    return INTERVAL_MS[key] ?? INTERVAL_MS['5分钟']
  } catch {
    return INTERVAL_MS['5分钟']
  }
}

export function shouldRefreshList(
  lastRefreshAt: number,
  intervalMs = readListRefreshIntervalMs()
): boolean {
  if (intervalMs <= 0) return false
  if (typeof document !== 'undefined' && document.hidden) return false
  return Date.now() - lastRefreshAt >= intervalMs
}
