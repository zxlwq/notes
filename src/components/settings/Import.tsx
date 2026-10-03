import React from 'react'
import { X, Database } from 'lucide-react'

interface ImportProps {
  isOpen: boolean
  uploadFile: File | null
  uploadPreview: string
  uploading: boolean
  onClose: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onConfirm: () => void
}

const Import: React.FC<ImportProps> = ({
  isOpen,
  uploadFile,
  uploadPreview,
  uploading,
  onClose,
  onFileSelect,
  onConfirm,
}) => {
  if (!isOpen) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center">
      <div className="mx-4 w-full max-w-md rounded-lg border border-white/50 bg-white/50 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/50 bg-white/50 px-6 py-4 backdrop-blur-lg">
          <h3 className="font-semibold text-gray-900">上传笔记</h3>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-400">
              <input
                type="file"
                accept=".json,.md,.txt,.markdown"
                onChange={onFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center">
                <Database className="mb-2 size-8 text-gray-400" />
                <span className="text-gray-600">
                  {uploadFile ? '重新选择文件' : '点击选择文件'}
                </span>
                <span className="mt-1 text-xs text-gray-500">支持 JSON、MD、TXT 格式</span>
              </label>
            </div>

            {uploadFile && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Database className="size-4 text-blue-600" />
                  <span className="font-medium text-blue-800">已选择文件</span>
                </div>
                <div className="text-blue-700">
                  <div>文件名：{uploadFile.name}</div>
                  <div>大小：{(uploadFile.size / 1024).toFixed(1)} KB</div>
                  <div>类型：{uploadFile.name.split('.').pop()?.toUpperCase()}</div>
                </div>
              </div>
            )}

            {uploadPreview && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 font-medium text-gray-800">文件预览：</div>
                <div className="max-h-32 overflow-y-auto rounded border bg-white p-2 text-xs text-gray-600">
                  <pre className="whitespace-pre-wrap">{uploadPreview}</pre>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={onClose}
                disabled={uploading}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                disabled={!uploadFile || uploading}
                className="rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {uploading ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Import
