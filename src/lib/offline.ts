import type { Note, NotesListResponse } from '@/types'
import { toNoteSummary } from '@/lib/notes'

const DB_NAME = 'notes-offline'
const DB_VERSION = 1
const NOTES_STORE = 'notes'
const PENDING_STORE = 'pending'

export type PendingOp = 'create' | 'update' | 'delete'

export interface PendingEntry {
  noteId: string
  op: PendingOp
  note?: Note
  queuedAt: string
}

export interface OfflineStatus {
  offline: boolean
  pending: number
  syncing: boolean
}

let dbPromise: Promise<IDBDatabase> | null = null
let syncing = false
// eslint-disable-next-line no-unused-vars -- callback type parameter
const statusListeners = new Set<(status: OfflineStatus) => void>()

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'noteId' })
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

function emitStatus(pending: number) {
  const status: OfflineStatus = {
    offline: !navigator.onLine,
    pending,
    syncing,
  }
  statusListeners.forEach((listener) => listener(status))
}

// eslint-disable-next-line no-unused-vars -- callback type parameter
export function subscribeOfflineStatus(listener: (status: OfflineStatus) => void): () => void {
  statusListeners.add(listener)
  void getPendingCount().then((pending) =>
    listener({ offline: !navigator.onLine, pending, syncing })
  )
  return () => statusListeners.delete(listener)
}

export function setOfflineSyncing(value: boolean) {
  syncing = value
  void getPendingCount().then(emitStatus)
}

export async function getPendingCount(): Promise<number> {
  const all = await getAllPending()
  return all.length
}

export async function saveOfflineNote(note: Note): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(NOTES_STORE, 'readwrite')
  tx.objectStore(NOTES_STORE).put({
    id: note.id,
    title: note.title ?? '',
    content: note.content ?? '',
    tags: note.tags ?? [],
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  })
  await txDone(tx)
}

export async function mergeOfflineSummaries(summaries: Note[]): Promise<void> {
  if (summaries.length === 0) return
  const existing = await getAllOfflineNotes()
  const map = new Map(existing.map((note) => [note.id, note]))
  const db = await openDb()
  const tx = db.transaction(NOTES_STORE, 'readwrite')
  const store = tx.objectStore(NOTES_STORE)
  for (const summary of summaries) {
    const prev = map.get(summary.id)
    store.put({
      id: summary.id,
      title: summary.title ?? prev?.title ?? '',
      content: prev?.content ?? '',
      tags: summary.tags ?? prev?.tags ?? [],
      createdAt: summary.createdAt ?? prev?.createdAt ?? new Date().toISOString(),
      updatedAt: summary.updatedAt ?? prev?.updatedAt ?? new Date().toISOString(),
    })
  }
  await txDone(tx)
}

export async function getOfflineNote(id: string): Promise<Note | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readonly')
    const req = tx.objectStore(NOTES_STORE).get(id)
    req.onsuccess = () => {
      const row = req.result as Note | undefined
      if (!row) {
        resolve(null)
        return
      }
      resolve({
        id: row.id,
        title: row.title ?? '',
        content: row.content ?? '',
        tags: row.tags ?? [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        contentLength: row.content?.length ?? 0,
      })
    }
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'))
  })
}

export async function getAllOfflineNotes(): Promise<Note[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readonly')
    const req = tx.objectStore(NOTES_STORE).getAll()
    req.onsuccess = () => {
      const rows = (req.result as Note[]) ?? []
      resolve(
        rows.map((row) => ({
          id: row.id,
          title: row.title ?? '',
          content: row.content ?? '',
          tags: row.tags ?? [],
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          contentLength: row.content?.length ?? 0,
        }))
      )
    }
    req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'))
  })
}

export async function removeOfflineNote(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(NOTES_STORE, 'readwrite')
  tx.objectStore(NOTES_STORE).delete(id)
  await txDone(tx)
}

export async function getAllPending(): Promise<PendingEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readonly')
    const req = tx.objectStore(PENDING_STORE).getAll()
    req.onsuccess = () => resolve((req.result as PendingEntry[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'))
  })
}

async function putPending(entry: PendingEntry): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(PENDING_STORE, 'readwrite')
  tx.objectStore(PENDING_STORE).put(entry)
  await txDone(tx)
  const pending = await getAllPending()
  emitStatus(pending.length)
}

export async function clearPending(noteId: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(PENDING_STORE, 'readwrite')
  tx.objectStore(PENDING_STORE).delete(noteId)
  await txDone(tx)
  const pending = await getAllPending()
  emitStatus(pending.length)
}

export async function queuePending(entry: Omit<PendingEntry, 'queuedAt'>): Promise<void> {
  const existing = (await getAllPending()).find((item) => item.noteId === entry.noteId)

  if (existing?.op === 'create' && entry.op === 'delete') {
    await removeOfflineNote(entry.noteId)
    await clearPending(entry.noteId)
    return
  }

  if (existing?.op === 'create' && entry.op === 'update' && entry.note) {
    await putPending({
      noteId: entry.noteId,
      op: 'create',
      note: entry.note,
      queuedAt: new Date().toISOString(),
    })
    await saveOfflineNote(entry.note)
    return
  }

  if (entry.op === 'delete') {
    await putPending({
      noteId: entry.noteId,
      op: 'delete',
      queuedAt: new Date().toISOString(),
    })
    await removeOfflineNote(entry.noteId)
    return
  }

  await putPending({ ...entry, queuedAt: new Date().toISOString() })
  if (entry.note) {
    await saveOfflineNote(entry.note)
  }
}

export async function getOfflineNotesPage(page = 1, limit = 30): Promise<NotesListResponse> {
  const all = await getAllOfflineNotes()
  all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const total = all.length
  const start = (page - 1) * limit
  const slice = all.slice(start, start + limit)
  const items = slice.map((note) => toNoteSummary(note))
  return {
    items,
    total,
    page,
    limit,
    hasMore: start + limit < total,
  }
}

export async function clearOfflineStore(): Promise<void> {
  dbPromise = null
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'))
    req.onblocked = () => resolve()
  })
  emitStatus(0)
}

export function isNetworkUnavailable(error: unknown): boolean {
  if (!navigator.onLine) return true
  if (error && typeof error === 'object' && 'response' in error) {
    return !(error as { response?: unknown }).response
  }
  return true
}
