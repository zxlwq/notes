import { notesApi } from '@/lib/api'
import type { Note } from '@/types'

const DB_NAME = 'notes-search'
const DB_VERSION = 1
const STORE = 'entries'

export interface SearchIndexEntry {
  id: string
  title: string
  tags: string[]
  content: string
  updatedAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function noteToEntry(note: Note): SearchIndexEntry {
  return {
    id: note.id,
    title: note.title ?? '',
    tags: note.tags ?? [],
    content: note.content ?? '',
    updatedAt: note.updatedAt,
  }
}

function entryIsFresh(summary: Note, entry: SearchIndexEntry | null): boolean {
  if (!entry) return false
  if (entry.updatedAt !== summary.updatedAt) return false
  const needsContent = (summary.contentLength ?? 0) > 0 || Boolean(summary.content)
  if (needsContent && !entry.content) return false
  return true
}

export async function upsertSearchIndexEntry(note: Note): Promise<void> {
  if (!note.id) return
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(noteToEntry(note))
  await txDone(tx)
}

export async function upsertSearchIndexEntries(notes: Note[]): Promise<void> {
  if (notes.length === 0) return
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  for (const note of notes) {
    if (note.content != null) store.put(noteToEntry(note))
  }
  await txDone(tx)
}

export async function removeSearchIndexEntry(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  await txDone(tx)
}

export async function clearSearchIndex(): Promise<void> {
  dbPromise = null
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'))
    req.onblocked = () => resolve()
  })
}

export async function getSearchIndexEntry(id: string): Promise<SearchIndexEntry | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as SearchIndexEntry | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
  })
}

export async function getSearchIndexStats(): Promise<{ indexed: number }> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve({ indexed: req.result })
    req.onerror = () => reject(req.error ?? new Error('IndexedDB count failed'))
  })
}

export async function readAllSearchIndexEntries(): Promise<SearchIndexEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as SearchIndexEntry[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('IndexedDB readAll failed'))
  })
}

const FETCH_BATCH = 5

/** 拉取缺失或过期的正文并写入 IndexedDB */
export async function ensureSearchIndexed(
  summaries: Note[],
  signal?: AbortSignal,
  maxFetches = Number.POSITIVE_INFINITY
): Promise<void> {
  const stale: Note[] = []
  for (const summary of summaries) {
    if (signal?.aborted) return
    const entry = await getSearchIndexEntry(summary.id)
    if (!entryIsFresh(summary, entry)) stale.push(summary)
  }

  const toFetch = stale.slice(0, maxFetches)
  for (let i = 0; i < toFetch.length; i += FETCH_BATCH) {
    if (signal?.aborted) return
    const batch = toFetch.slice(i, i + FETCH_BATCH)
    await Promise.all(
      batch.map(async (summary) => {
        if (signal?.aborted) return
        try {
          const res = await notesApi.getNote(summary.id)
          if (signal?.aborted) return
          await upsertSearchIndexEntry(res.data)
        } catch {
          // skip failed note
        }
      })
    )
  }
}

export interface IndexWarmProgress {
  done: number
  total: number
}

let warmProgress: IndexWarmProgress | null = null
let warmTask: Promise<void> | null = null

export function getSearchIndexWarmProgress(): IndexWarmProgress | null {
  return warmProgress
}

/** 后台预热全文索引（解密后存本地，供搜索复用） */
export function warmSearchIndex(summaries: Note[], signal?: AbortSignal): Promise<void> {
  if (warmTask) return warmTask
  warmTask = (async () => {
    const needContent = summaries.filter((s) => (s.contentLength ?? 0) > 0 || s.content)
    warmProgress = { done: 0, total: needContent.length }
    try {
      for (let i = 0; i < needContent.length; i += FETCH_BATCH) {
        if (signal?.aborted) return
        const batch = needContent.slice(i, i + FETCH_BATCH)
        const pending: Note[] = []
        for (const summary of batch) {
          const entry = await getSearchIndexEntry(summary.id)
          if (!entryIsFresh(summary, entry)) pending.push(summary)
        }
        await ensureSearchIndexed(pending, signal, pending.length)
        warmProgress = {
          done: Math.min(i + batch.length, needContent.length),
          total: needContent.length,
        }
      }
    } finally {
      warmProgress = null
      warmTask = null
    }
  })()
  return warmTask
}

/** 离线或 API 不可用时，从 IndexedDB 读取已索引的正文（不要求 updatedAt 一致） */
export async function loadNoteFromSearchIndex(summary: Note): Promise<Note | null> {
  const entry = await getSearchIndexEntry(summary.id)
  if (!entry?.content) return null
  return { ...summary, title: entry.title, tags: entry.tags, content: entry.content }
}

/** 列表摘要 updatedAt 与索引一致时，可跳过 API 直接展示 */
export async function loadNoteFromSearchIndexIfFresh(summary: Note): Promise<Note | null> {
  const entry = await getSearchIndexEntry(summary.id)
  if (!entryIsFresh(summary, entry) || !entry) return null
  return { ...summary, title: entry.title, tags: entry.tags, content: entry.content }
}

export async function hydrateNoteFromIndex(summary: Note): Promise<Note> {
  const entry = await getSearchIndexEntry(summary.id)
  if (entryIsFresh(summary, entry) && entry) {
    return { ...summary, title: entry.title, tags: entry.tags, content: entry.content }
  }
  if (summary.content != null) {
    await upsertSearchIndexEntry(summary)
    return summary
  }
  try {
    const res = await notesApi.getNote(summary.id)
    await upsertSearchIndexEntry(res.data)
    return { ...summary, ...res.data }
  } catch {
    return summary
  }
}

export function buildContentSnippet(
  content: string,
  query: string,
  caseSensitive: boolean,
  radius = 40
): { snippet: string; startIndex: number; endIndex: number } | null {
  const haystack = caseSensitive ? content : content.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const hit = haystack.indexOf(needle)
  if (hit < 0) return null

  const start = Math.max(0, hit - radius)
  const end = Math.min(content.length, hit + needle.length + radius)
  let snippet = content.slice(start, end).replace(/\s+/g, ' ').trim()
  if (start > 0) snippet = `…${snippet}`
  if (end < content.length) snippet = `${snippet}…`

  return {
    snippet,
    startIndex: hit,
    endIndex: hit + needle.length,
  }
}
