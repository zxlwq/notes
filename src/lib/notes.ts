import type { Note } from '@/types'

/** 列表/缓存用摘要，不含正文 */
export function toNoteSummary(note: Note): Note {
  const contentLength = note.contentLength ?? note.content?.length ?? 0
  return {
    id: note.id,
    title: note.title,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    contentLength,
  }
}

export function toNoteSummaries(notes: Note[]): Note[] {
  return notes.map(toNoteSummary)
}

export function cacheNotes(notes: Note[]) {
  const summaries = toNoteSummaries(notes)
  const json = JSON.stringify(summaries)
  sessionStorage.setItem('notes-cache', json)
  localStorage.setItem('notes-cache', json)
}

export function readNotesCache(): Note[] {
  try {
    const raw = sessionStorage.getItem('notes-cache') || localStorage.getItem('notes-cache')
    if (!raw) return []
    const parsed = JSON.parse(raw) as Note[]
    return Array.isArray(parsed) ? toNoteSummaries(parsed) : []
  } catch {
    return []
  }
}

/** 从列表缓存按 id 取摘要（无正文），用于路由跳转时保留布局壳层 */
export function findCachedNote(id: string): Note | undefined {
  return readNotesCache().find((n) => n.id === id)
}

// eslint-disable-next-line no-unused-vars -- 回调类型占位参数
export function updateNotesCache(updater: (notes: Note[]) => Note[]) {
  const current = readNotesCache()
  cacheNotes(updater(current))
}
