import React, { useCallback, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { Modal } from '../Modal'
import { copyToClipboard, downloadFile } from '@/lib/utils'

interface RecoveryProps {
  isOpen: boolean
  code: string
  onClose: () => void
}

const Recovery: React.FC<RecoveryProps> = ({ isOpen, code, onClose }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(code)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [code])

  const handleDownload = useCallback(() => {
    const content = `notes 密码恢复码\n\n${code}\n\n请妥善保管。此码仅可重置登录密码，无法恢复已加密笔记内容。`
    downloadFile(content, 'notes-recovery-code.txt')
  }, [code])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="恢复码已生成"
      type="success"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          请立即保存以下恢复码，关闭后将<strong>无法再次查看</strong>。恢复码仅能重置
          <strong>登录密码</strong>，若加密密钥已丢失，<strong>无法解密</strong>已加密笔记。
        </p>
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-center font-mono text-lg tracking-wider text-green-900">
          {code}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Copy className="size-4" />
            {copied ? '已复制' : '复制到剪贴板'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="size-4" />
            下载 .txt
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            我已保存
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default Recovery
