import React, { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { applySwUpdate, dismissSwUpdate, onSwPending } from '@/lib/sw'

const SwUp: React.FC = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return onSwPending((pending) => setVisible(pending))
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/30 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="text-sm text-gray-800">新版本已就绪，刷新后即可使用。</p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              void applySwUpdate()
            }}
          >
            <RefreshCw className="mr-1 size-4" />
            刷新
          </Button>
          <button
            type="button"
            aria-label="稍后刷新"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={() => {
              dismissSwUpdate()
              setVisible(false)
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SwUp
