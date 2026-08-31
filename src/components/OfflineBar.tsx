import { useEffect, useState } from 'react'
import type { OfflineStatus } from '@/lib/offline'
import { subscribeOfflineStatus } from '@/lib/offlineSync'

export default function OfflineBar() {
  const [status, setStatus] = useState<OfflineStatus>({
    offline: !navigator.onLine,
    pending: 0,
    syncing: false,
  })

  useEffect(() => subscribeOfflineStatus(setStatus), [])

  if (!status.offline && status.pending === 0) return null

  let message: string
  if (status.syncing) {
    message = '正在同步离线更改…'
  } else if (status.offline && status.pending > 0) {
    message = `当前离线，${status.pending} 条更改待同步`
  } else if (status.offline) {
    message = '当前离线，可浏览和编辑已缓存的笔记'
  } else {
    message = `${status.pending} 条离线更改待同步`
  }

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-16 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-lg border border-amber-200/70 bg-amber-50/95 px-4 py-2 text-center text-sm text-amber-900 shadow backdrop-blur-sm"
    >
      {message}
    </div>
  )
}
