import React, { useState, useEffect, Suspense, lazy, useRef, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings, Tag, Menu, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import NoteCard from '@/components/Card'
import AdvancedSearch from '@/components/Advanced'
import BackToTop from '@/components/BackTop'
import { AlertModal, ConfirmModal } from '@/components/Modal'
import { useModal } from '@/hooks/Modal'
import { notesApi, orderApi } from '@/lib/api'
import { cacheNotes, readNotesCache, toNoteSummaries, updateNotesCache } from '@/lib/notes'
import { warmSearchIndex, removeSearchIndexEntry } from '@/lib/search'
import { readListRefreshIntervalMs, shouldRefreshList } from '@/lib/listRefresh'
import { useEscapeClose, useFocusTrap } from '@/hooks/Trap'
import type { Note, SettingsChangedEvent } from '@/types'

const SettingsModal = lazy(() => import('@/components/Settings'))
const PAGE_SIZE = 30

const List: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [notes, setNotes] = useState<Note[]>(() => {
    const state = location.state as { notes?: Note[] } | null
    if (state?.notes && Array.isArray(state.notes)) {
      return toNoteSummaries(state.notes)
    }
    return readNotesCache()
  })
  const [filteredNotes, setFilteredNotes] = useState<Note[]>(() => {
    const state = location.state as { notes?: Note[] } | null
    if (state?.notes && Array.isArray(state.notes)) {
      return toNoteSummaries(state.notes)
    }
    return readNotesCache()
  })
  const [loading, setLoading] = useState(() => readNotesCache().length === 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [searchActive, setSearchActive] = useState(false)
  const [loadAnnounce, setLoadAnnounce] = useState('')
  const [error, setError] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const headerMenuRef = useRef<HTMLDivElement>(null)
  useFocusTrap(headerMenuOpen, headerMenuRef)
  useEscapeClose(headerMenuOpen, () => setHeaderMenuOpen(false))
  const [displayTitle, setDisplayTitle] = useState('')
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const [, setDraggedTag] = useState<string | null>(null)
  const [tagOrder, setTagOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tag-order')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch {}
    return []
  })
  const [flash, setFlash] = useState<{
    action: 'created' | 'updated'
    title: string
    noteId?: string
    timestamp: number
  } | null>(() => {
    try {
      const raw = localStorage.getItem('note-flash')
      if (!raw) return null
      const data = JSON.parse(raw)
      if (
        data &&
        (data.action === 'created' || data.action === 'updated') &&
        typeof data.title === 'string' &&
        typeof data.timestamp === 'number'
      ) {
        return {
          action: data.action,
          title: data.title,
          noteId: data.noteId,
          timestamp: data.timestamp,
        }
      }
    } catch {}
    return null
  })
  const hasInitialCacheRef = useRef<boolean>(readNotesCache().length > 0)
  const notesRef = useRef(notes)
  notesRef.current = notes
  const pageRef = useRef(1)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const searchActiveRef = useRef(false)
  searchActiveRef.current = searchActive
  const lastSilentRefreshRef = useRef(0)
  const refreshIntervalMsRef = useRef(readListRefreshIntervalMs())

  const modal = useModal()
  const orderAppliedRef = useRef(false)

  const loadNoteOrder = useCallback(async (): Promise<string[]> => {
    try {
      const response = await orderApi.getOrder('note-order')
      const data = response.data?.data
      if (data && Array.isArray(data)) {
        return data
      }
      return []
    } catch {
      try {
        const raw = localStorage.getItem('note-order')
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
  }, [])

  const applyOrder = useCallback(
    async (list: Note[]): Promise<Note[]> => {
      const order = await loadNoteOrder()
      if (!Array.isArray(list) || list.length === 0 || order.length === 0) return list
      const idToNote = new Map(list.map((n) => [n.id, n]))
      const ordered: Note[] = []
      for (const id of order) {
        const note = idToNote.get(id)
        if (note) {
          ordered.push(note)
          idToNote.delete(id)
        }
      }

      for (const note of list) {
        if (idToNote.has(note.id)) {
          ordered.push(note)
        }
      }
      return ordered
    },
    [loadNoteOrder]
  )

  const searchSummariesCacheRef = useRef<{ at: number; items: Note[] } | null>(null)
  const SEARCH_SCOPE_TTL_MS = 60_000

  const invalidateSearchScope = useCallback(() => {
    searchSummariesCacheRef.current = null
  }, [])

  const loadSearchSummaries = useCallback(async (): Promise<Note[]> => {
    const now = Date.now()
    const cached = searchSummariesCacheRef.current
    if (cached && now - cached.at < SEARCH_SCOPE_TTL_MS) {
      return cached.items
    }
    const all = await notesApi.getAllSummaries()
    const ordered = await applyOrder(toNoteSummaries(all))
    searchSummariesCacheRef.current = { at: now, items: ordered }
    void warmSearchIndex(ordered)
    return ordered
  }, [applyOrder])

  const saveNoteOrder = useCallback(async (list: Note[]) => {
    try {
      const ids = Array.isArray(list) ? list.map((n) => n.id) : []
      await orderApi.saveOrder('note-order', ids)
      localStorage.setItem('note-order', JSON.stringify(ids))
    } catch {
      try {
        const ids = Array.isArray(list) ? list.map((n) => n.id) : []
        localStorage.setItem('note-order', JSON.stringify(ids))
      } catch {}
    }
  }, [])

  const applyLoadedNotes = useCallback(
    async (list: Note[], replace: boolean) => {
      invalidateSearchScope()
      const merged = replace
        ? list
        : [
            ...notesRef.current,
            ...list.filter((n) => !notesRef.current.some((existing) => existing.id === n.id)),
          ]
      const ordered = await applyOrder(toNoteSummaries(merged))
      setNotes(ordered)
      if (!searchActiveRef.current) {
        setFilteredNotes(ordered)
      }
      cacheNotes(ordered)
      await saveNoteOrder(ordered)
      void warmSearchIndex(ordered)
      return ordered
    },
    [applyOrder, saveNoteOrder, invalidateSearchScope]
  )

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      pageRef.current = 1

      const response = await notesApi.getNotesPage(1, PAGE_SIZE)
      const { items, hasMore: more, total } = response.data

      const ordered = await applyLoadedNotes(items, true)
      setHasMore(more)
      setLoadAnnounce(`已加载 ${ordered.length} / ${total} 条笔记`)
    } catch (err: unknown) {
      console.error('Load notes error:', err)
      if (!navigator.onLine) {
        const cached = readNotesCache()
        if (cached.length > 0) {
          setNotes(cached)
          setFilteredNotes(cached)
          setError('当前离线，显示本地缓存的笔记')
          return
        }
      }
      const error = err as { response?: { status: number }; message?: string }
      if (error.response?.status === 401) {
        setError('未授权访问，请重新登录')
      } else {
        setError('加载笔记失败: ' + (error.message || '未知错误'))
      }
    } finally {
      setLoading(false)
    }
  }, [applyLoadedNotes])

  const loadMoreNotes = useCallback(async () => {
    if (loadingMore || !hasMore || loading || searchActiveRef.current) return

    try {
      setLoadingMore(true)
      const nextPage = pageRef.current + 1
      const response = await notesApi.getNotesPage(nextPage, PAGE_SIZE)
      const { items, hasMore: more, total } = response.data

      const ordered = await applyLoadedNotes(items, false)
      pageRef.current = nextPage
      setHasMore(more)
      setLoadAnnounce(`已加载 ${ordered.length} / ${total} 条笔记`)
    } catch (err: unknown) {
      console.error('Load more notes error:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [applyLoadedNotes, hasMore, loading, loadingMore])

  const loadNotesSilently = useCallback(
    async (force = false) => {
      const intervalMs = refreshIntervalMsRef.current
      if (!force) {
        if (intervalMs <= 0) return
        if (!shouldRefreshList(lastSilentRefreshRef.current, intervalMs)) return
      }

      try {
        const pagesToLoad = Math.max(1, pageRef.current)
        const merged: Note[] = []

        for (let page = 1; page <= pagesToLoad; page += 1) {
          const response = await notesApi.getNotesPage(page, PAGE_SIZE)
          merged.push(...response.data.items)
          if (!response.data.hasMore) {
            pageRef.current = page
            setHasMore(false)
            break
          }
          if (page === pagesToLoad) {
            setHasMore(response.data.hasMore)
          }
        }

        const ordered = await applyOrder(toNoteSummaries(merged))

        if (JSON.stringify(ordered) === JSON.stringify(notesRef.current)) {
          lastSilentRefreshRef.current = Date.now()
          return
        }

        setNotes(ordered)
        if (!searchActiveRef.current) {
          setFilteredNotes(ordered)
        }
        cacheNotes(ordered)
        invalidateSearchScope()
        await saveNoteOrder(ordered)
        lastSilentRefreshRef.current = Date.now()
      } catch (_err: unknown) {
        if (!navigator.onLine) {
          const cached = readNotesCache()
          if (cached.length > 0) {
            setNotes(cached)
            setFilteredNotes(cached)
            setError('当前离线，显示本地缓存的笔记')
          }
        }
        console.error('Load notes error (silent):', _err)
      }
    },
    [applyOrder, saveNoteOrder, invalidateSearchScope]
  )

  useEffect(() => {
    const state = location.state as { notes?: Note[] } | null
    const hasCache =
      (state?.notes && state.notes.length > 0) || hasInitialCacheRef.current || notes.length > 0
    if (hasCache) {
      setTimeout(() => {
        lastSilentRefreshRef.current = 0
        loadNotesSilently(true)
      }, 100)
    } else {
      loadNotes()
    }
    const loadSettingsTitle = () => {
      try {
        const saved = localStorage.getItem('app-settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.username && typeof parsed.username === 'string') {
            setDisplayTitle(parsed.username)
          }
        }
      } catch {}
    }
    loadSettingsTitle()

    const loadTagOrder = async () => {
      try {
        const response = await orderApi.getOrder('tag-order')
        const data = response.data?.data
        if (data && Array.isArray(data) && data.length > 0) {
          setTagOrder((current) => {
            const currentStr = JSON.stringify(current)
            const newStr = JSON.stringify(data)
            if (currentStr !== newStr) {
              return data
            }
            return current
          })
          localStorage.setItem('tag-order', JSON.stringify(data))
        }
      } catch {}
    }
    loadTagOrder()

    const settingsHandler = (event: SettingsChangedEvent) => {
      loadSettingsTitle()
      if (event.detail?.listRefreshInterval) {
        refreshIntervalMsRef.current = readListRefreshIntervalMs()
      }

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

    const notesImportedHandler = () => {
      loadNotes()
    }
    window.addEventListener('notes-imported', notesImportedHandler as EventListener)

    const notesLoadedHandler = (event: CustomEvent) => {
      const newNotes = event.detail
      if (Array.isArray(newNotes)) {
        setNotes(newNotes)
        setFilteredNotes(newNotes)
        setLoading(false)
      }
    }
    window.addEventListener('notes-loaded', notesLoadedHandler as EventListener)

    const scheduleSilentRefresh = () => {
      void loadNotesSilently()
    }

    const intervalMs = refreshIntervalMsRef.current
    const refreshTimer =
      intervalMs > 0 ? window.setInterval(scheduleSilentRefresh, intervalMs) : undefined

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleSilentRefresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (refreshTimer) window.clearInterval(refreshTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('settings-changed', settingsHandler as EventListener)
      window.removeEventListener('notes-imported', notesImportedHandler as EventListener)
      window.removeEventListener('notes-loaded', notesLoadedHandler as EventListener)
    }
  }, [loadNotes, loadNotesSilently, location.state, notes.length])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !hasMore || searchActive) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreNotes()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMoreNotes, filteredNotes.length, searchActive])

  const handleSearchActiveChange = useCallback((active: boolean) => {
    setSearchActive(active)
  }, [])

  useEffect(() => {
    if (orderAppliedRef.current || notes.length === 0) return

    orderAppliedRef.current = true
    applyOrder(notes).then((ordered) => {
      if (JSON.stringify(ordered.map((n) => n.id)) !== JSON.stringify(notes.map((n) => n.id))) {
        setNotes(ordered)
        setFilteredNotes(ordered)
      }
    })
  }, [applyOrder, notes])

  const handleCreateNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: '新笔记',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    navigate(`/notes/${newNote.id}/edit`, { state: { note: newNote, isNew: true } })
  }

  const handleViewNote = (note: Note, scrollToTag?: string) => {
    navigate(`/notes/${note.id}`, { state: { note, ...(scrollToTag ? { scrollToTag } : {}) } })
  }

  const handleCardTagClick = (note: Note, tag: string) => {
    handleViewNote(note, tag)
  }

  const handleDeleteNote = async (noteId: string) => {
    const confirmed = await modal.showConfirm('确定要删除这个笔记吗？此操作不可撤销。', {
      title: '删除确认',
      type: 'warning',
      confirmText: '删除',
      cancelText: '取消',
    })

    if (!confirmed) {
      return
    }

    try {
      await notesApi.deleteNote(noteId)
      void removeSearchIndexEntry(noteId)

      invalidateSearchScope()
      setNotes((prev: Note[]) => prev.filter((note: Note) => note.id !== noteId))
      setFilteredNotes((prev: Note[]) => prev.filter((note: Note) => note.id !== noteId))

      try {
        const current = await loadNoteOrder()
        const updated = current.filter((id) => id !== noteId)
        await orderApi.saveOrder('note-order', updated)
        localStorage.setItem('note-order', JSON.stringify(updated))
      } catch {
        try {
          const raw = localStorage.getItem('note-order')
          const parsed = raw ? JSON.parse(raw) : []
          const updated = parsed.filter((id: string) => id !== noteId)
          localStorage.setItem('note-order', JSON.stringify(updated))
        } catch {}
      }
      updateNotesCache((list) => list.filter((n) => n.id !== noteId))
      try {
        sessionStorage.removeItem('note-cache:' + `/notes/${noteId}`)
        localStorage.removeItem('note-cache:' + `/notes/${noteId}`)
      } catch {}

      modal.showAlert('笔记删除成功！', {
        type: 'success',
        title: '删除成功',
        confirmText: '确定',
      })
    } catch (err: unknown) {
      console.error('删除笔记失败:', err)
      modal.showAlert('删除笔记失败，请检查网络连接', {
        type: 'error',
        title: '删除失败',
        confirmText: '确定',
      })
    }
  }

  const handleSettings = () => {
    setIsSettingsOpen(true)
  }

  const handleSearch = (results: Note[]) => {
    setFilteredNotes(results)
  }

  const handleTagClick = (tag: string) => {
    const notesWithTag = notes.filter((note: Note) => note.tags && note.tags.includes(tag))
    if (notesWithTag.length > 0) {
      const first = notesWithTag[0]
      navigate(`/notes/${first.id}`, { state: { note: first, scrollToTag: tag } })
    }
  }

  const getAllTags = useMemo(() => {
    const allTags = new Set<string>()
    notes.forEach((note: Note) => {
      if (note.tags) {
        note.tags.forEach((tag: string) => allTags.add(tag))
      }
    })
    const tagsArray = Array.from(allTags)

    if (tagOrder.length > 0) {
      const orderedTags = tagOrder.filter((tag) => allTags.has(tag))
      const newTags = tagsArray.filter((tag) => !tagOrder.includes(tag))
      return [...orderedTags, ...newTags.sort()]
    }

    return tagsArray.sort()
  }, [notes, tagOrder])

  const handleNoteDragStart = (e: React.DragEvent, noteId: string) => {
    setDraggedNoteId(noteId)
    ;(e.currentTarget as HTMLElement).style.opacity = '0.5'
  }

  const handleNoteDragEnd = (e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).style.opacity = '1'
    setDraggedNoteId(null)
  }

  const handleNoteDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleNoteDrop = async (e: React.DragEvent, targetNoteId: string) => {
    e.preventDefault()
    if (!draggedNoteId || draggedNoteId === targetNoteId) return

    const draggedIndex = filteredNotes.findIndex((note) => note.id === draggedNoteId)
    const targetIndex = filteredNotes.findIndex((note) => note.id === targetNoteId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newNotes = [...filteredNotes]
    const draggedNote = newNotes[draggedIndex]
    newNotes.splice(draggedIndex, 1)
    newNotes.splice(targetIndex, 0, draggedNote)

    setFilteredNotes(newNotes)
    setNotes(newNotes)

    try {
      cacheNotes(newNotes)
    } catch {}

    await saveNoteOrder(newNotes)
  }

  const reorderNote = async (noteId: string, target: 'top' | 'bottom') => {
    const list = [...filteredNotes]
    const index = list.findIndex((note) => note.id === noteId)
    if (index === -1) return
    if (target === 'top' && index === 0) return
    if (target === 'bottom' && index === list.length - 1) return

    const [note] = list.splice(index, 1)
    if (target === 'top') list.unshift(note)
    else list.push(note)

    setFilteredNotes(list)
    setNotes(list)
    try {
      cacheNotes(list)
    } catch {}
    await saveNoteOrder(list)
  }

  const handleTagDragStart = (e: React.DragEvent, tag: string) => {
    setDraggedTag(tag)
    e.dataTransfer.setData('text/plain', tag)
    ;(e.currentTarget as HTMLElement).style.opacity = '0.5'
  }

  const handleTagDragEnd = (e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).style.opacity = '1'
    setDraggedTag(null)
  }

  const handleTagDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleTagDrop = async (e: React.DragEvent, targetTag: string) => {
    e.preventDefault()
    const draggedTagName = e.dataTransfer.getData('text/plain')
    if (!draggedTagName || draggedTagName === targetTag) return

    const currentTags = getAllTags
    const draggedIndex = currentTags.findIndex((tag) => tag === draggedTagName)
    const targetIndex = currentTags.findIndex((tag) => tag === targetTag)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newTagOrder = [...currentTags]
    const draggedTagValue = newTagOrder[draggedIndex]
    newTagOrder.splice(draggedIndex, 1)
    newTagOrder.splice(targetIndex, 0, draggedTagValue)

    setTagOrder(newTagOrder)

    try {
      await orderApi.saveOrder('tag-order', newTagOrder)
      localStorage.setItem('tag-order', JSON.stringify(newTagOrder))
    } catch {
      try {
        localStorage.setItem('tag-order', JSON.stringify(newTagOrder))
      } catch {}
    }
  }

  const formatRelativeTime = (time: number) => {
    const diff = Date.now() - time
    const sec = Math.floor(diff / 1000)
    if (sec < 10) return '刚刚'
    if (sec < 60) return `${sec}秒前`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}分钟前`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}小时前`
    const day = Math.floor(hr / 24)
    if (day < 7) return `${day}天前`
    const d = new Date(time)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${dd} ${hh}:${mm}`
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
      <form style={{ display: 'none' }} method="post" action="/login" data-form="login">
        <input
          type="text"
          name="username"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          tabIndex={-1}
          aria-hidden="true"
        />
        <button type="submit" tabIndex={-1} aria-hidden="true">
          登录
        </button>
      </form>

      <header className="border-b border-white/30 bg-white/30 shadow-sm backdrop-blur-md">
        <div className="relative flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {flash && (
            <button
              onClick={() => {
                if (flash.noteId) {
                  const cached =
                    notes.find((n) => n.id === flash.noteId) ??
                    filteredNotes.find((n) => n.id === flash.noteId) ??
                    readNotesCache().find((n) => n.id === flash.noteId)
                  navigate(`/notes/${flash.noteId}`, {
                    state: cached ? { note: cached } : undefined,
                  })
                }
                try {
                  localStorage.removeItem('note-flash')
                } catch {}
                setFlash(null)
              }}
              className={`absolute left-1/2 inline-flex -translate-x-1/2 items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:opacity-90 ${flash.action === 'created' ? 'border-green-200/80 bg-green-50/80 text-green-700' : 'border-blue-200/80 bg-blue-50/80 text-blue-700'}`}
              style={{ backdropFilter: 'blur(2px)' }}
              data-flash-pill
            >
              {flash.action === 'created' ? '新建了' : '修改了'}
              {`“${flash.title || '无标题'}”笔记 · ${formatRelativeTime(flash.timestamp)}`}
            </button>
          )}

          <h1
            className="font-semibold text-gray-900"
            style={{ fontSize: 'var(--global-font-size, 16px)' }}
          >
            {displayTitle || '笔记系统'}
          </h1>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:ml-4 sm:gap-4 lg:flex-none">
            <div className="relative z-[9998] min-w-0 flex-1 sm:w-48 sm:flex-none md:w-80">
              <AdvancedSearch
                notes={notes}
                loadSearchSummaries={loadSearchSummaries}
                onSearch={handleSearch}
                onSearchActiveChange={handleSearchActiveChange}
                placeholder="搜索笔记..."
              />
            </div>
            <div className="hidden shrink-0 space-x-2 sm:flex">
              <Button onClick={handleCreateNote} variant="success">
                <Plus className="mr-2 size-4" />
                新建笔记
              </Button>
              <Button onClick={handleSettings} variant="primary">
                <Settings className="mr-2 size-4" />
                设置
              </Button>
            </div>
            <div className="relative shrink-0 sm:hidden">
              <Button
                onClick={() => setHeaderMenuOpen((open) => !open)}
                variant="ghost"
                size="lg"
                aria-label="打开菜单"
                aria-expanded={headerMenuOpen}
              >
                {headerMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
              {headerMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 bg-black/20"
                    aria-label="关闭菜单"
                    onClick={() => setHeaderMenuOpen(false)}
                  />
                  <div
                    ref={headerMenuRef}
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-40 rounded-lg border border-white/50 bg-white/95 py-2 shadow-lg backdrop-blur-md"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        setHeaderMenuOpen(false)
                        handleCreateNote()
                      }}
                    >
                      <Plus className="mr-2 size-4" />
                      新建笔记
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-gray-100"
                      onClick={() => {
                        setHeaderMenuOpen(false)
                        handleSettings()
                      }}
                    >
                      <Settings className="mr-2 size-4" />
                      设置
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {loadAnnounce}
        </div>
        <div className="flex gap-6">
          <div className="-ml-4 w-80 flex-shrink-0 sm:-ml-6 lg:-ml-8">
            <div className="ml-4 rounded-lg border border-white/30 bg-white/40 p-4 shadow backdrop-blur-lg sm:ml-6 lg:ml-8">
              <h3
                className="mb-4 flex items-center font-semibold text-gray-900"
                style={{ fontSize: 'var(--global-font-size, 16px)' }}
              >
                <Tag className="mr-2 size-5" />
                标签
              </h3>
              <div className="space-y-2">
                {getAllTags.map((tag) => {
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xl font-semibold"
                      style={{
                        backgroundColor: 'transparent',
                        color: '#FFFFFF',
                        transition: 'none',
                      }}
                      draggable
                      onDragStart={(e) => handleTagDragStart(e, tag)}
                      onDragEnd={handleTagDragEnd}
                      onDragOver={handleTagDragOver}
                      onDrop={(e) => handleTagDrop(e, tag)}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
                        e.currentTarget.style.color = '#111827'
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = '#FFFFFF'
                      }}
                    >
                      <span className="flex items-center">
                        <Tag className="mr-2 size-3" />
                        {tag}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 sm:px-6 lg:px-8">
            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
                <div className="text-red-600">{error}</div>
              </div>
            )}

            {filteredNotes.length > 0 ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {filteredNotes.map((note: Note, index: number) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onView={handleViewNote}
                    onTagClick={handleCardTagClick}
                    onDelete={handleDeleteNote}
                    onDragStart={handleNoteDragStart}
                    onDragEnd={handleNoteDragEnd}
                    onDragOver={handleNoteDragOver}
                    onDrop={handleNoteDrop}
                    onMoveToTop={(id) => void reorderNote(id, 'top')}
                    onMoveToBottom={(id) => void reorderNote(id, 'bottom')}
                    canMoveToTop={index > 0}
                    canMoveToBottom={index < filteredNotes.length - 1}
                  />
                ))}
                {hasMore && !searchActive && (
                  <div
                    ref={loadMoreRef}
                    className="col-span-full py-6 text-center text-sm text-gray-500"
                  >
                    {loadingMore ? '加载更多...' : '向下滚动加载更多'}
                  </div>
                )}
                {searchActive && (
                  <div className="col-span-full py-4 text-center text-xs text-gray-400">
                    搜索使用本地索引（IndexedDB），已覆盖全部笔记
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="mb-4 text-gray-400">
                  <svg
                    className="mx-auto size-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3
                  className="mb-2 font-medium text-gray-900"
                  style={{ fontSize: 'var(--global-font-size, 16px)' }}
                >
                  {loading
                    ? '正在加载笔记...'
                    : notes.length === 0
                      ? '还没有笔记'
                      : '没有找到匹配的笔记'}
                </h3>
                <p className="mb-4 text-gray-500">
                  {loading
                    ? '请稍候，正在为您准备内容...'
                    : notes.length === 0
                      ? '点击"新建笔记"开始创建您的第一个笔记'
                      : '尝试使用不同的关键词搜索，或调整搜索选项'}
                </p>
              </div>
            )}
          </div>
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

export default List
