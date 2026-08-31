import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Save, ArrowLeft, Settings, Home, Sparkles } from 'lucide-react'
import BackToTop from '@/components/BackTop'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import { AlertModal, ConfirmModal } from '@/components/Modal'
import NotesEditor from '@/components/Editor'
import EditorToolbar from '@/components/Toolbar'
import { useModal } from '@/hooks/Modal'
import { notesApi } from '@/lib/api'
import { toNoteSummary, updateNotesCache, findCachedNote } from '@/lib/notes'
import { upsertSearchIndexEntry } from '@/lib/search'
import {
  acquireEditLock,
  broadcastNoteUpdated,
  isNoteLockedByOtherTab,
  onNoteUpdated,
  refreshEditLock,
  releaseEditLock,
} from '@/lib/noteSync'
import type { Note } from '@/types'
import '@/components/Editor.css'

const SettingsModal = lazy(() => import('@/components/Settings'))
const AiPanel = lazy(() => import('@/components/ai/Panel'))

function snapshotNote(note: Pick<Note, 'title' | 'content' | 'tags'>): string {
  return JSON.stringify({
    title: note.title,
    content: note.content,
    tags: note.tags,
  })
}

const Edit: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [note, setNote] = useState<Note | null>(() => {
    const state = location.state as { note?: Note; isNew?: boolean } | null
    if (state?.isNew && state.note) return state.note
    if (state?.note) return state.note
    return id ? (findCachedNote(id) ?? null) : null
  })
  const [loading, setLoading] = useState<boolean>(() => {
    const state = location.state as { note?: Note; isNew?: boolean } | null
    if (state?.note || state?.isNew) return false
    return id ? !findCachedNote(id) : true
  })
  const [contentLoading, setContentLoading] = useState<boolean>(() => {
    const state = location.state as { note?: Note; isNew?: boolean } | null
    if (state?.isNew && state.note) return false
    const initial = state?.note ?? (id ? findCachedNote(id) : undefined)
    return initial?.content == null && Boolean(initial)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [isNewNote, setIsNewNote] = useState(() => {
    const state = location.state as { note?: Note; isNew?: boolean } | null
    return Boolean(state?.isNew)
  })
  const [tagInput, setTagInput] = useState('')
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [editorReady] = useState(true)
  const initialNoteSnapshotRef = useRef<string | null>(null)
  const remoteUpdatedAtRef = useRef<string | null>(null)
  const navNoteInitRef = useRef(false)
  const modal = useModal()
  const [conflictWarning, setConflictWarning] = useState('')

  const captureInitialSnapshot = useCallback((value: Note) => {
    initialNoteSnapshotRef.current = snapshotNote(value)
  }, [])

  const isDirty = useCallback(() => {
    if (!note || !initialNoteSnapshotRef.current) return false
    return snapshotNote(note) !== initialNoteSnapshotRef.current
  }, [note])

  const confirmDiscardChanges = useCallback(async () => {
    if (!isDirty()) return true
    return modal.showConfirm('有未保存的更改，确定放弃吗？', {
      title: '放弃更改',
      type: 'warning',
      confirmText: '放弃',
      cancelText: '继续编辑',
    })
  }, [isDirty, modal])

  const loadNote = useCallback(async () => {
    if (!id) return

    const hasShell = note != null
    try {
      if (hasShell) {
        setContentLoading(true)
      } else {
        setLoading(true)
      }
      setError('')
      const response = await notesApi.getNote(id)

      if (response.data && response.data.id) {
        const loadedNote = {
          id: response.data.id,
          title: response.data.title || '无标题',
          content: response.data.content || '',
          tags: response.data.tags || [],
          createdAt: response.data.createdAt || new Date().toISOString(),
          updatedAt: response.data.updatedAt || new Date().toISOString(),
        }
        setNote(loadedNote)
        remoteUpdatedAtRef.current = loadedNote.updatedAt
        captureInitialSnapshot(loadedNote)
      } else {
        throw new Error('笔记数据格式不正确')
      }
    } catch (err: unknown) {
      console.error('Load note error:', err)
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      setError('加载笔记失败: ' + errorMessage)
    } finally {
      setLoading(false)
      setContentLoading(false)
    }
  }, [id, note, captureInitialSnapshot])

  useEffect(() => {
    initialNoteSnapshotRef.current = null
    remoteUpdatedAtRef.current = null
    navNoteInitRef.current = false
    setConflictWarning('')
  }, [id])

  useEffect(() => {
    if (!id || isNewNote) return

    if (isNoteLockedByOtherTab(id)) {
      setConflictWarning('其他标签页正在编辑此笔记，保存前请注意冲突。')
    } else {
      acquireEditLock(id)
    }

    const lockTimer = window.setInterval(() => refreshEditLock(id), 60_000)
    const unsubscribe = onNoteUpdated((message) => {
      if (message.noteId !== id) return
      if (remoteUpdatedAtRef.current && message.updatedAt > remoteUpdatedAtRef.current) {
        remoteUpdatedAtRef.current = message.updatedAt
        setConflictWarning('其他标签页已保存此笔记，你的未保存更改可能与之冲突。')
      }
    })

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void notesApi.getNote(id).then((response) => {
        const remoteUpdatedAt = response.data.updatedAt
        if (remoteUpdatedAtRef.current && remoteUpdatedAt > remoteUpdatedAtRef.current) {
          remoteUpdatedAtRef.current = remoteUpdatedAt
          setConflictWarning('此笔记已在其他地方更新，保存前请确认是否覆盖。')
        }
      })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(lockTimer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      releaseEditLock(id)
    }
  }, [id, isNewNote])

  useEffect(() => {
    const state = location.state as { note?: Note; isNew?: boolean }
    if (state?.note && state?.isNew) {
      if (!navNoteInitRef.current) {
        navNoteInitRef.current = true
        setNote(state.note)
        remoteUpdatedAtRef.current = state.note.updatedAt
        setIsNewNote(true)
        captureInitialSnapshot(state.note)
        setLoading(false)
      }
    } else if (note && note.content == null) {
      loadNote()
    } else if (note && initialNoteSnapshotRef.current === null) {
      remoteUpdatedAtRef.current = note.updatedAt
      captureInitialSnapshot(note)
      setLoading(false)
      setContentLoading(false)
    } else if (!note) {
      loadNote()
    } else {
      setLoading(false)
    }

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

    return () => {
      window.removeEventListener('settings-changed', settingsHandler as EventListener)
    }
  }, [id, location.state, loadNote, note, captureInitialSnapshot])

  const handleContentChange = useCallback((value: string) => {
    setNote((prev) => (prev ? { ...prev, content: value } : null))
  }, [])

  const handleTitleChange = (value: string) => {
    if (note) {
      setNote((prev) => (prev ? { ...prev, title: value } : null))
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && note) {
      const newTag = tagInput.trim()
      if (!note.tags.includes(newTag)) {
        setNote((prev) => (prev ? { ...prev, tags: [...prev.tags, newTag] } : null))
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    if (note) {
      setNote((prev) =>
        prev ? { ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) } : null
      )
    }
  }

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleApplyAiTags = useCallback(
    (tags: string[]) => {
      if (!note) return
      const merged = [...note.tags]
      for (const tag of tags) {
        if (!merged.includes(tag)) merged.push(tag)
      }
      setNote((prev) => (prev ? { ...prev, tags: merged } : null))
    },
    [note]
  )

  const checkRemoteConflict = useCallback(async (): Promise<boolean> => {
    if (!note?.id || isNewNote || !navigator.onLine) return false

    try {
      const response = await notesApi.getNote(note.id)
      const remoteUpdatedAt = response.data.updatedAt
      const baseline = remoteUpdatedAtRef.current

      if (baseline && remoteUpdatedAt > baseline && isDirty()) {
        const overwrite = await modal.showConfirm(
          '其他标签页或窗口已更新此笔记。是否仍要保存并覆盖远程版本？',
          {
            title: '编辑冲突',
            type: 'warning',
            confirmText: '覆盖保存',
            cancelText: '取消',
          }
        )
        return !overwrite
      }
      return false
    } catch {
      return false
    }
  }, [isDirty, isNewNote, modal, note?.id])

  const handleSave = async () => {
    if (!note) {
      setError('笔记数据不存在')
      return
    }

    if (!note.id && !isNewNote) {
      setError('笔记ID不存在，无法保存')
      return
    }

    try {
      setSaving(true)
      setError('')

      if (await checkRemoteConflict()) {
        setSaving(false)
        return
      }

      const noteData = {
        title: note.title || '无标题',
        content: note.content || '',
        tags: note.tags || [],
      }

      if (isNewNote) {
        const response = await notesApi.createNote(
          {
            ...noteData,
            id: note.id,
            createdAt: note.createdAt,
          },
          { remoteOnly: true }
        )
        const newNoteId = response.data && response.data.id ? response.data.id : note.id
        const createdAt = new Date().toISOString()
        void upsertSearchIndexEntry({
          id: newNoteId,
          ...noteData,
          createdAt,
          updatedAt: createdAt,
        })
        setIsNewNote(false)

        try {
          localStorage.setItem(
            'note-flash',
            JSON.stringify({
              action: 'created',
              title: noteData.title,
              noteId: newNoteId,
              timestamp: Date.now(),
            })
          )
        } catch {}

        setShowSuccessMessage(true)

        setTimeout(() => {
          setShowSuccessMessage(false)
          navigate(`/notes/${newNoteId}`, {
            state: {
              note: {
                id: newNoteId,
                title: noteData.title,
                content: noteData.content,
                tags: noteData.tags,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          })
          try {
            updateNotesCache((list) => [
              toNoteSummary({
                id: newNoteId,
                title: noteData.title,
                content: noteData.content,
                tags: noteData.tags,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
              ...list,
            ])
          } catch {}
        }, 1500)

        return
      } else {
        await notesApi.updateNote(note.id, noteData, { remoteOnly: true })
        const savedUpdatedAt = new Date().toISOString()
        void upsertSearchIndexEntry({
          id: note.id,
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags,
          createdAt: note.createdAt,
          updatedAt: savedUpdatedAt,
        })
        remoteUpdatedAtRef.current = savedUpdatedAt
        broadcastNoteUpdated(note.id, savedUpdatedAt)
        setConflictWarning('')

        try {
          localStorage.setItem(
            'note-flash',
            JSON.stringify({
              action: 'updated',
              title: note.title || '无标题',
              noteId: note.id,
              timestamp: Date.now(),
            })
          )
        } catch {}
      }

      setNote((prev) =>
        prev
          ? {
              ...prev,
              updatedAt: new Date().toISOString(),
            }
          : null
      )

      setShowSuccessMessage(true)
      captureInitialSnapshot({
        title: note.title,
        content: note.content,
        tags: note.tags,
        id: note.id,
        createdAt: note.createdAt,
        updatedAt: new Date().toISOString(),
      })

      setTimeout(() => {
        setShowSuccessMessage(false)
        navigate(`/notes/${note.id}`, {
          state: {
            note: {
              id: note.id,
              title: note.title,
              content: note.content,
              tags: note.tags,
              createdAt: note.createdAt,
              updatedAt: new Date().toISOString(),
            },
          },
        })
        try {
          updateNotesCache((list) =>
            list.map((n) =>
              n.id === note.id
                ? toNoteSummary({
                    ...n,
                    title: note.title,
                    tags: note.tags,
                    content: note.content,
                    updatedAt: new Date().toISOString(),
                  })
                : n
            )
          )
        } catch {}
      }, 1500)
    } catch (err: unknown) {
      console.error('Save note error:', err)
      if (err && typeof err === 'object' && 'response' in err) {
        const errorWithResponse = err as {
          response?: { data?: { error?: string }; status?: number }
        }
        console.error('Error response:', errorWithResponse.response?.data)
        console.error('Error status:', errorWithResponse.response?.status)

        if (errorWithResponse.response?.status === 401) {
          setError('未授权访问，请重新登录')
        } else if (errorWithResponse.response?.status === 404) {
          setError('笔记不存在')
        } else if (errorWithResponse.response?.status === 400) {
          setError('数据格式错误: ' + (errorWithResponse.response?.data?.error || '未知错误'))
        } else if (errorWithResponse.response?.status === 405) {
          setError('请求方法不被允许，请检查API配置')
        } else if (errorWithResponse.response?.status === 500) {
          setError('服务器错误: ' + (errorWithResponse.response?.data?.error || '未知错误'))
        } else {
          setError('保存失败，请稍后重试')
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : '未知错误'
        setError('保存失败: ' + errorMessage)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleBack = async () => {
    if (!(await confirmDiscardChanges())) return

    if (isNewNote || !note?.id) {
      navigate('/notes')
      return
    }

    navigate(`/notes/${note.id}`, { state: { note } })
  }

  const handleHome = async () => {
    if (!(await confirmDiscardChanges())) return
    navigate('/notes')
  }

  const handleSettings = () => {
    setIsSettingsOpen(true)
  }

  if (loading && !note) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-100/60 to-gray-200/60"
        style={{
          backgroundImage: "var(--app-bg-image, url('/background.webp'))",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <header className="border-b border-white/30 bg-white/30 shadow-sm backdrop-blur-md">
          <div className="w-full">
            <div className="flex h-16 items-center">
              <Button onClick={handleBack} variant="primary">
                <ArrowLeft className="mr-2 size-4" />
                返回
              </Button>
              <div className="flex flex-1 justify-center px-2">
                <span className="font-semibold text-gray-900">加载中...</span>
              </div>
            </div>
          </div>
        </header>
        <main className="w-full">
          <div className="w-full pb-6">
            <div
              data-layout-card
              className="overflow-hidden rounded-lg border border-white/40 bg-white/60 shadow backdrop-blur-md"
            >
              <Loading inline size="md" text="加载笔记中..." />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2
            className="mb-4 font-bold text-gray-900"
            style={{ fontSize: 'calc(var(--global-font-size, 16px) * 1.25)' }}
          >
            笔记不存在
          </h2>
          <p className="mb-6 text-gray-600">您要查看的笔记可能已被删除或不存在。</p>
          <Button onClick={handleBack} variant="secondary">
            <ArrowLeft className="mr-2 size-4" />
            返回笔记列表
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-100/60 to-gray-200/60"
      style={{
        backgroundImage: "var(--app-bg-image, url('/background.webp'))",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <header className="border-b border-white/30 bg-white/30 shadow-sm backdrop-blur-md">
        <div className="w-full">
          <div className="flex h-16 items-center">
            <Button onClick={handleBack} variant="primary">
              <ArrowLeft className="mr-2 size-4" />
              返回
            </Button>
            <Button onClick={handleHome} variant="primary" className="ml-2">
              <Home className="mr-2 size-4" />
              首页
            </Button>
            <div className="flex flex-1 flex-col items-center space-y-2">
              <label htmlFor="note-title" className="sr-only">
                笔记标题
              </label>
              <input
                id="note-title"
                type="text"
                value={note.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="输入笔记标题..."
                className="title-input max-w-md border-none bg-transparent text-center font-semibold text-gray-900 placeholder-gray-400 outline-none"
                style={{
                  fontSize: 'calc(var(--global-font-size, 16px) * 1.5)',
                  fontFamily: 'var(--editor-font-family, inherit)',
                  lineHeight: 'var(--global-line-height, 1.6)',
                }}
              />
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={() => setIsAiOpen(true)} variant="primary">
                <Sparkles className="mr-2 size-4" />
                AI
              </Button>
              <Button onClick={handleSave} loading={saving} variant="success">
                <Save className="mr-2 size-4" />
                保存
              </Button>
              <Button onClick={handleSettings} variant="primary">
                <Settings className="mr-2 size-4" />
                设置
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        <div className="w-full pb-6">
          {conflictWarning && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="text-amber-800">{conflictWarning}</div>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
              <div className="text-red-600">{error}</div>
            </div>
          )}

          <div
            data-layout-card
            className="flex flex-col overflow-hidden border-y border-white/30 bg-white/30 shadow backdrop-blur-md md:flex-row md:items-stretch"
            data-edit-row
          >
            <EditorToolbar embedded />

            <div className="min-w-0 flex-1 md:border-l md:border-white/30">
              {contentLoading ? (
                <div className="p-8 text-center">
                  <Loading size="md" text="加载笔记中..." inline />
                </div>
              ) : editorReady ? (
                <NotesEditor
                  value={note.content ?? ''}
                  onChange={handleContentChange}
                  placeholder="开始编写您的笔记..."
                  tags={note.tags}
                  tagInput={tagInput}
                  onTagInputChange={(value) => setTagInput(value)}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onTagInputKeyPress={handleTagInputKeyPress}
                />
              ) : (
                <div className="p-8 text-center">
                  <Loading size="md" text="初始化编辑器中..." />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Suspense fallback={null}>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </Suspense>

      <Suspense fallback={null}>
        {note && (
          <AiPanel
            isOpen={isAiOpen}
            onClose={() => setIsAiOpen(false)}
            title={note.title}
            onApplyTags={handleApplyAiTags}
          />
        )}
      </Suspense>

      {showSuccessMessage && (
        <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-green-500 px-6 py-3 text-white shadow-lg">
          保存成功！
        </div>
      )}

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

export default Edit
