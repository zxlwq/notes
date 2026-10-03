import React, { useCallback, useEffect, useId, useState } from 'react'
import { Link2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import Button from '@/components/ui/Button'
import { notesApi, shareApi } from '@/lib/api'
import { copyTextToast } from '@/lib/viewScroll'
import type { Note, ShareExpiresIn, ShareListItem } from '@/types'

const EXPIRY_OPTIONS: { value: ShareExpiresIn; label: string }[] = [
  { value: '1d', label: '1 天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: 'never', label: '永久' },
]

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  note: Note
  /** 列表卡片可能无正文，打开时再拉取 */
  ensureContent?: boolean
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  note,
  ensureContent = false,
}) => {
  const formId = useId()
  const [expiresIn, setExpiresIn] = useState<ShareExpiresIn>('7d')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<ShareListItem[]>([])
  const [snapshot, setSnapshot] = useState<Note | null>(null)

  const loadShares = useCallback(async () => {
    try {
      const res = await shareApi.listByNote(note.id)
      setItems(res.data.items || [])
    } catch {
      setItems([])
    }
  }, [note.id])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setError('')
    setExpiresIn('7d')
    setBusy(false)
    setSnapshot(null)
    setLoading(true)
    setItems([])

    void (async () => {
      try {
        const needFetch = ensureContent || note.content == null
        const [noteResult] = await Promise.all([
          needFetch ? notesApi.getNote(note.id) : Promise.resolve(null),
          loadShares(),
        ])
        if (cancelled) return
        setSnapshot(needFetch && noteResult ? noteResult.data : note)
      } catch {
        if (!cancelled) {
          setError('无法加载笔记内容，请先打开详情后再分享')
          setSnapshot(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, note, ensureContent, loadShares])

  const handleCreate = async (e: React.FormEvent) => {
    // 只接受真正的表单 submit（点提交按钮或在表单内回车），不接受穿透 click
    e.preventDefault()
    if (!snapshot || loading || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await shareApi.create({
        noteId: snapshot.id,
        title: snapshot.title || '无标题',
        content: snapshot.content || '',
        tags: snapshot.tags || [],
        expiresIn,
      })
      const url = window.location.origin + (res.data.urlPath || `/s/${res.data.token}`)
      try {
        await navigator.clipboard.writeText(url)
        copyTextToast('已复制')
      } catch {
        copyTextToast('创建成功，但复制失败，请手动复制链接')
      }
      await loadShares()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        '创建分享失败'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async (token: string) => {
    setBusy(true)
    setError('')
    try {
      await shareApi.revoke(token)
      await loadShares()
      copyTextToast('已撤销分享')
    } catch {
      setError('撤销失败')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async (urlPath: string) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + urlPath)
      copyTextToast('已复制')
    } catch {
      setError('复制失败')
    }
  }

  // 未打开时不挂载内容，配合父级 key 保证每次打开都是全新状态
  if (!isOpen) return null

  const canCreate = Boolean(snapshot) && !loading && !busy

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="公开分享" type="info">
      <form id={formId} className="space-y-4 text-sm text-gray-800" onSubmit={handleCreate}>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          公开链接将以<strong>明文快照</strong>
          存储，任何人拿到链接即可阅读；之后修改笔记不会更新已分享内容。
        </p>

        <fieldset disabled={busy || loading} className="block">
          <legend className="mb-2 font-medium text-gray-700">有效期</legend>
          <div className="grid grid-cols-4 gap-2">
            {EXPIRY_OPTIONS.map((opt) => {
              const selected = expiresIn === opt.value
              return (
                <label
                  key={opt.value}
                  className={
                    selected
                      ? 'cursor-pointer rounded-md border border-blue-500 bg-blue-50 p-2 text-center font-medium text-blue-800'
                      : 'cursor-pointer rounded-md border border-gray-300 bg-white p-2 text-center text-gray-700 hover:border-gray-400'
                  }
                >
                  <input
                    type="radio"
                    name={`${formId}-expires`}
                    value={opt.value}
                    checked={selected}
                    onChange={() => setExpiresIn(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <p className="min-h-5 text-gray-500">
          {loading && !error ? '正在加载笔记内容…' : '\u00a0'}
        </p>
        {error && <p className="text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="success" type="submit" loading={busy || loading} disabled={!canCreate}>
            创建并复制链接
          </Button>
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <p className="mb-2 font-medium text-gray-700">已有分享</p>
            <ul className="space-y-2">
              {items.map((item) => {
                const href = window.location.origin + item.urlPath
                return (
                  <li
                    key={item.token}
                    className="flex items-center justify-between gap-2 rounded-md bg-white/50 px-2 py-1.5"
                  >
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-left text-blue-600 hover:underline"
                      title={`打开 ${item.urlPath}`}
                    >
                      <Link2 className="mr-1 inline size-3.5" />
                      {item.urlPath}
                      {item.expiresAt
                        ? ` · 至 ${new Date(item.expiresAt).toLocaleDateString('zh-CN')}`
                        : ' · 永久'}
                    </a>
                    <button
                      type="button"
                      className="shrink-0 rounded px-1.5 py-1 text-xs text-gray-600 hover:bg-white/80 hover:text-blue-600"
                      title="复制链接"
                      onClick={() => handleCopy(item.urlPath)}
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-gray-500 hover:text-red-600"
                      title="撤销"
                      disabled={busy}
                      onClick={() => handleRevoke(item.token)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  )
}

export default ShareDialog
