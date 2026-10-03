import React from 'react'
import { X } from 'lucide-react'
import {
  translateLevel,
  translateMessage,
  formatLogTime,
  formatMeta,
} from '@/components/settings/logTr'

export type LogItem = {
  id?: number
  level?: string
  message?: string
  meta?: string
  created_at?: string
  [key: string]: unknown
}

interface LogsProps {
  isOpen: boolean
  loading: boolean
  logsText: string
  logsData: { items?: LogItem[] } | null
  logsView: 'table' | 'json'
  onClose: () => void
  onRefresh: () => void
  onToggleView: () => void
  onClear: () => void
}

const Logs: React.FC<LogsProps> = ({
  isOpen,
  loading,
  logsText,
  logsData,
  logsView,
  onClose,
  onRefresh,
  onToggleView,
  onClear,
}) => {
  if (!isOpen) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div className="pointer-events-auto mx-4 w-full max-w-3xl overflow-hidden rounded-lg border border-white/20 bg-white/20 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/20 bg-white/20 px-6 py-4 backdrop-blur-lg">
          <h3 className="font-semibold text-gray-900">后端调用日志</h3>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto bg-white/20 px-6 py-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={onToggleView}
              className="rounded-md border border-transparent bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {logsView === 'table' ? '切换JSON视图' : '切换表格视图'}
            </button>
            <button
              onClick={onRefresh}
              className="rounded-md border border-transparent bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              刷新
            </button>
            <button
              onClick={onClear}
              className="rounded-md border border-transparent bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              清空日志
            </button>
          </div>
          {loading ? (
            <div className="text-gray-600">加载中...</div>
          ) : logsView === 'json' ? (
            <pre className="whitespace-pre-wrap break-words rounded-md border border-white/20 bg-white/10 p-3 text-xs text-gray-800">
              {logsText || '暂无日志'}
            </pre>
          ) : (
            <div className="overflow-hidden rounded-md border border-white/20">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-3 py-2 text-gray-600">时间</th>
                    <th className="px-3 py-2 text-gray-600">级别</th>
                    <th className="px-3 py-2 text-gray-600">事件</th>
                    <th className="px-3 py-2 text-gray-600">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {(logsData?.items || []).length === 0 ? (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={4}>
                        暂无日志
                      </td>
                    </tr>
                  ) : (
                    (logsData?.items || []).map((it, idx) => {
                      let meta: unknown = null
                      try {
                        meta = it.meta ? JSON.parse(it.meta) : null
                      } catch {
                        meta = it.meta || null
                      }
                      const levelColor =
                        it.level === 'error'
                          ? 'text-red-600'
                          : it.level === 'warn' || it.level === 'warning'
                            ? 'text-yellow-700'
                            : 'text-gray-800'
                      return (
                        <tr key={it.id || idx} className={idx % 2 ? 'bg-white/5' : 'bg-white/10'}>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                            {formatLogTime(it.created_at)}
                          </td>
                          <td className={`whitespace-nowrap px-3 py-2 font-medium ${levelColor}`}>
                            {translateLevel(it.level)}
                          </td>
                          <td className="whitespace-pre-wrap px-3 py-2 text-gray-800">
                            {translateMessage(it.message)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {meta ? (
                              <pre className="whitespace-pre-wrap break-words rounded border border-white/20 bg-white/10 p-2 text-xs">
                                {typeof meta === 'string'
                                  ? meta
                                  : String(formatMeta(it.message, meta))}
                              </pre>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-white/20 bg-white/20 px-6 py-4 backdrop-blur-lg">
          <button
            onClick={onClose}
            className="rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default Logs
