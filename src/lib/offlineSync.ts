import type { Note } from '@/types'
import { encryptContent, encryptField, encryptTags, getEncryptionPassword } from '@/lib/crypto'
import { api } from '@/lib/client'
import {
  clearPending,
  getAllPending,
  getPendingCount,
  queuePending,
  saveOfflineNote,
  setOfflineSyncing,
  subscribeOfflineStatus,
} from '@/lib/offline'
import { upsertSearchIndexEntry, removeSearchIndexEntry } from '@/lib/search'

export { subscribeOfflineStatus, getPendingCount }

async function encryptPayload(note: {
  title: string
  content: string
  tags?: string[]
}): Promise<{ title: string; content: string; tags?: string[] }> {
  const password = getEncryptionPassword()
  if (!password) return note

  const payload: { title: string; content: string; tags?: string[] } = {
    title: note.title,
    content: note.content,
  }
  if (note.title) payload.title = await encryptField(note.title, password)
  if (note.tags?.length) payload.tags = [await encryptTags(note.tags, password)]
  if (note.content) payload.content = await encryptContent(note.content, password)
  return payload
}

async function syncCreate(note: Note): Promise<void> {
  const payload = await encryptPayload({
    title: note.title,
    content: note.content ?? '',
    tags: note.tags,
  })
  await api.post('/api/notes', {
    ...payload,
    id: note.id,
    createdAt: note.createdAt,
  })
}

async function syncUpdate(note: Note): Promise<void> {
  const payload = await encryptPayload({
    title: note.title,
    content: note.content ?? '',
    tags: note.tags,
  })
  try {
    await api.put(`/api/notes/${note.id}`, payload)
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined
    if (status === 404) {
      await syncCreate(note)
      return
    }
    throw err
  }
}

async function syncDelete(noteId: string): Promise<void> {
  try {
    await api.delete(`/api/notes/${noteId}`)
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined
    if (status === 404) return
    throw err
  }
}

export async function flushOfflineQueue(): Promise<void> {
  if (!navigator.onLine) return

  const pending = await getAllPending()
  if (pending.length === 0) return

  setOfflineSyncing(true)
  try {
    const sorted = [...pending].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
    for (const entry of sorted) {
      if (entry.op === 'delete') {
        await syncDelete(entry.noteId)
        await clearPending(entry.noteId)
        continue
      }
      if (!entry.note) {
        await clearPending(entry.noteId)
        continue
      }
      if (entry.op === 'create') {
        await syncCreate(entry.note)
      } else {
        await syncUpdate(entry.note)
      }
      await saveOfflineNote(entry.note)
      void upsertSearchIndexEntry(entry.note)
      await clearPending(entry.noteId)
    }
  } finally {
    setOfflineSyncing(false)
  }
}

export function initOfflineSync(): void {
  const run = () => {
    void flushOfflineQueue()
  }
  window.addEventListener('online', run)
  run()
}

export async function offlineCreateNote(note: Note): Promise<{ id: string }> {
  await saveOfflineNote(note)
  await queuePending({ noteId: note.id, op: 'create', note })
  void upsertSearchIndexEntry(note)
  return { id: note.id }
}

export async function offlineUpdateNote(note: Note): Promise<void> {
  const updated: Note = { ...note, updatedAt: new Date().toISOString() }
  await queuePending({ noteId: note.id, op: 'update', note: updated })
  void upsertSearchIndexEntry(updated)
}

export async function offlineDeleteNote(noteId: string): Promise<void> {
  await queuePending({ noteId, op: 'delete' })
  void removeSearchIndexEntry(noteId)
}
