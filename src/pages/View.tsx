import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BackToTop from '@/components/BackTop'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import Bar from '@/components/view/Bar'
import Meta from '@/components/view/Meta'
import Md from '@/components/view/Md'
import { AlertModal, ConfirmModal } from '@/components/Modal'
import { useModal } from '@/hooks/Modal'
import { notesApi } from '@/lib/api'
import { updateNotesCache, findCachedNote } from '@/lib/notes'
import {
  loadNoteFromSearchIndex,
  loadNoteFromSearchIndexIfFresh,
  removeSearchIndexEntry,
  upsertSearchIndexEntry,
} from '@/lib/search'
import { scrollToTag } from '@/lib/viewScroll'
import type { Note } from '@/types'

const SettingsModal = lazy(() => import('@/components/Settings'))

function noteSummary(id: string): Note {
  return (
    findCachedNote(id) ??
    ({ id, title: '', tags: [], createdAt: '', updatedAt: '', contentLength: 0 } as Note)
  )
}

const pageBgStyle = {
  backgroundImage: "var(--app-bg-image, url('/background.webp'))",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed' as const,
}

const View: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [note, setNote] = useState<Note | null>(() => {
    const state = location.state as { note?: Note } | null
    if (state?.note) return state.note
    return id ? (findCachedNote(id) ?? null) : null
  })

  const [highlightPosition] = useState<{
    startIndex: number
    endIndex: number
    searchTerm: string
  } | null>(() => {
    const state = location.state as {
      highlightPosition?: { startIndex: number; endIndex: number; searchTerm: string }
    } | null
    return state?.highlightPosition || null
  })
  const [scrollToTagFromState] = useState<string | null>(() => {
    const state = location.state as { scrollToTag?: string } | null
    return state?.scrollToTag || null
  })
  const [contentLoading, setContentLoading] = useState<boolean>(() => {
    const state = location.state as { note?: Note } | null
    const initial = state?.note ?? (id ? findCachedNote(id) : undefined)
    return initial?.content == null
  })
  const [error, setError] = useState('')
  const [cachedContent, setCachedContent] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const modal = useModal()

  const refreshNoteFromApi = useCallback(async (noteId: string) => {
    try {
      const response = await notesApi.getNote(noteId)
      setNote((current) => (current?.id === noteId ? response.data : current))
      setCachedContent(false)
      void upsertSearchIndexEntry(response.data)
    } catch (err: unknown) {
      console.error('Refresh note error:', err)
    }
  }, [])

  const loadNote = useCallback(async () => {
    if (!id) return

    setError('')
    const summary = noteSummary(id)

    const freshCached = await loadNoteFromSearchIndexIfFresh(summary)
    if (freshCached?.content != null) {
      setNote(freshCached)
      setContentLoading(false)
      setCachedContent(false)
      return
    }

    const staleCached = await loadNoteFromSearchIndex(summary)
    if (staleCached?.content != null) {
      setNote(staleCached)
      setContentLoading(false)
      setCachedContent(true)
      if (navigator.onLine) {
        void refreshNoteFromApi(id)
      }
      return
    }

    try {
      setContentLoading(true)
      setCachedContent(false)
      const response = await notesApi.getNote(id)
      setNote(response.data)
      void upsertSearchIndexEntry(response.data)
    } catch (err: unknown) {
      console.error('Load note error:', err)
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined

      if (status !== 404 && status !== 401) {
        const cached = await loadNoteFromSearchIndex(summary)
        if (cached?.content != null) {
          setNote(cached)
          setCachedContent(true)
          return
        }
      }

      if (status === 404) {
        setError('笔记不存在')
      } else if (status === 401) {
        setError('未授权访问')
      } else if (!navigator.onLine) {
        setError('当前离线，且无本地缓存的正文')
      } else {
        const errorMessage = err instanceof Error ? err.message : '未知错误'
        setError('加载笔记失败: ' + errorMessage)
      }
    } finally {
      setContentLoading(false)
    }
  }, [id, refreshNoteFromApi])

  useEffect(() => {
    if (!scrollToTagFromState || !note?.content || contentLoading) return
    const timer = setTimeout(() => scrollToTag(scrollToTagFromState), 150)
    return () => clearTimeout(timer)
  }, [scrollToTagFromState, note?.content, contentLoading])

  useEffect(() => {
    if (!id) return
    if (note?.content != null) return
    loadNote()
  }, [id, note?.content, loadNote])

  useEffect(() => {
    const settingsHandler = (event: CustomEvent) => {
      const settings = event.detail
      if (settings && settings.backgroundImageUrl) {
        const bg = settings.backgroundImageUrl.trim()
        if (bg) {
          document.documentElement.style.setProperty('--app-bg-image', `url('${bg}')`)
          const body = document.body
          if (body) {
            body.style.backgroundImage = `url('${bg}')`
            body.style.backgroundSize = 'cover'
            body.style.backgroundPosition = 'center'
            body.style.backgroundRepeat = 'no-repeat'
            body.style.backgroundAttachment = 'fixed'
          }
        } else {
          document.documentElement.style.removeProperty('--app-bg-image')
          const body = document.body
          if (body) {
            body.style.backgroundImage = "url('/background.webp')"
            body.style.backgroundSize = 'cover'
            body.style.backgroundPosition = 'center'
            body.style.backgroundRepeat = 'no-repeat'
            body.style.backgroundAttachment = 'fixed'
          }
        }
      }
    }
    window.addEventListener('settings-changed', settingsHandler as EventListener)
    return () => window.removeEventListener('settings-changed', settingsHandler as EventListener)
  }, [])

  const handleEdit = () => {
    if (note) {
      navigate(`/notes/${note.id}/edit`, { state: { note, isNew: false } })
    }
  }

  const handleDelete = async () => {
    if (!note) return

    const confirmed = await modal.showConfirm('确定要删除这个笔记吗？此操作不可撤销。', {
      title: '删除确认',
      type: 'warning',
      confirmText: '删除',
      cancelText: '取消',
    })
    if (!confirmed) return

    try {
      setIsDeleting(true)
      await notesApi.deleteNote(note.id)
      void removeSearchIndexEntry(note.id)
      modal.showAlert('笔记删除成功！', {
        type: 'success',
        title: '删除成功',
        confirmText: '确定',
      })
      setTimeout(() => {
        try {
          updateNotesCache((list) => list.filter((n) => n.id !== note.id))
        } catch {}
        navigate('/notes')
      }, 1000)
    } catch (err) {
      console.error('删除笔记失败:', err)
      modal.showAlert('删除笔记失败，请检查网络连接', {
        type: 'error',
        title: '删除失败',
        confirmText: '确定',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (!note && error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100/60 to-gray-200/60"
        style={pageBgStyle}
      >
        <div className="text-center">
          <h2
            className="mb-4 font-bold text-gray-900"
            style={{ fontSize: 'calc(var(--global-font-size, 16px) * 1.25)' }}
          >
            {error === '笔记不存在' ? '笔记不存在' : '加载失败'}
          </h2>
          <p className="mb-6 text-gray-600">{error}</p>
          <Button onClick={() => navigate('/notes')} variant="secondary">
            <ArrowLeft className="mr-2 size-4" />
            返回笔记列表
          </Button>
        </div>
      </div>
    )
  }

  const showShell = Boolean(id)
  const shellTitle = note?.title || (contentLoading ? '加载中...' : '无标题')

  if (!showShell) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100/60 to-gray-200/60"
        style={pageBgStyle}
      >
        <Loading size="lg" text="加载内容中..." />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-100/60 to-gray-200/60"
      style={pageBgStyle}
    >
      <Bar
        title={shellTitle}
        onBack={() => navigate('/notes')}
        onEdit={note ? handleEdit : undefined}
        onDelete={note ? handleDelete : undefined}
        onSettings={() => setIsSettingsOpen(true)}
        isDeleting={isDeleting}
        showNoteActions={Boolean(note)}
      />

      <main className="w-full">
        <div className="w-full px-4 pb-6 sm:px-6 lg:px-8">
          {cachedContent && (
            <p className="mb-3 rounded-lg border border-amber-200/60 bg-amber-50/80 px-4 py-2 text-sm text-amber-800 backdrop-blur-sm">
              {!navigator.onLine
                ? '当前离线，显示本地缓存的正文（可能不是最新）'
                : '正在后台同步最新内容…'}
            </p>
          )}
          {note ? (
            <div
              data-layout-card
              className="rounded-lg border border-white/40 bg-white/60 shadow backdrop-blur-md"
              style={{ wordBreak: 'break-word' }}
            >
              <div className="p-6" style={{ wordBreak: 'break-word' }}>
                <Meta note={note} onTagClick={scrollToTag} />
                <Md
                  noteId={note.id}
                  content={note.content}
                  rawContent={note.content}
                  loading={contentLoading}
                  onEdit={handleEdit}
                  highlightRange={
                    highlightPosition
                      ? {
                          startIndex: highlightPosition.startIndex,
                          endIndex: highlightPosition.endIndex,
                          searchTerm: highlightPosition.searchTerm,
                        }
                      : null
                  }
                />
              </div>
            </div>
          ) : (
            <div
              data-layout-card
              className="rounded-lg border border-white/40 bg-white/60 shadow backdrop-blur-md"
            >
              <div className="p-6">
                <Loading inline size="md" text="加载笔记中..." />
              </div>
            </div>
          )}
        </div>
      </main>

      <Suspense fallback={null}>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </Suspense>

      <AlertModal
        isOpen={modal.alertState.isOpen}
        onClose={modal.closeAlert}
        title={modal.alertState.title}
        message={modal.alertState.message}
        type={modal.alertState.type}
        confirmText={modal.alertState.confirmText}
        onConfirm={modal.alertState.onConfirm}
      />

      <ConfirmModal
        isOpen={modal.confirmState.isOpen}
        onClose={modal.closeConfirm}
        title={modal.confirmState.title}
        message={modal.confirmState.message}
        type={modal.confirmState.type}
        confirmText={modal.confirmState.confirmText}
        cancelText={modal.confirmState.cancelText}
        onConfirm={modal.confirmState.onConfirm || (() => {})}
        onCancel={modal.confirmState.onCancel}
      />
      <BackToTop />
    </div>
  )
}

export default View
