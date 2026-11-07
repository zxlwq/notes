import type { AppSettings } from '@/types'

const LOCK_TIMEOUT_MS: Record<string, number> = {
  '5分钟': 300_000,
  '15分钟': 900_000,
  '30分钟': 1_800_000,
  '1小时': 3_600_000,
}

export const LOCK_TIMEOUT_OPTIONS = ['5分钟', '15分钟', '30分钟', '1小时'] as const

export function readLockSettings(): { autoLock: boolean; timeoutMs: number } {
  try {
    const saved = localStorage.getItem('app-settings')
    if (!saved) return { autoLock: true, timeoutMs: LOCK_TIMEOUT_MS['15分钟'] }
    const parsed = JSON.parse(saved) as Partial<AppSettings>
    const autoLock = parsed.autoLock ?? true
    const key = parsed.lockTimeout ?? '15分钟'
    return { autoLock, timeoutMs: LOCK_TIMEOUT_MS[key] ?? LOCK_TIMEOUT_MS['15分钟'] }
  } catch {
    return { autoLock: true, timeoutMs: LOCK_TIMEOUT_MS['15分钟'] }
  }
}

export function lockSettingsFromDetail(detail: Partial<AppSettings>): {
  autoLock: boolean
  timeoutMs: number
} {
  const autoLock = detail.autoLock ?? true
  const key = detail.lockTimeout ?? '15分钟'
  return { autoLock, timeoutMs: LOCK_TIMEOUT_MS[key] ?? LOCK_TIMEOUT_MS['15分钟'] }
}
