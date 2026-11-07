const CHANNEL_NAME = 'notes-sync'
const LOCK_PREFIX = 'note-edit-lock:'

function getTabId(): string {
  const key = 'notes-tab-id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

const TAB_ID = getTabId()

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

export interface NoteUpdatedMessage {
  type: 'note-updated'
  noteId: string
  updatedAt: string
  tabId: string
}

export function broadcastNoteUpdated(noteId: string, updatedAt: string): void {
  getChannel()?.postMessage({
    type: 'note-updated',
    noteId,
    updatedAt,
    tabId: TAB_ID,
  } satisfies NoteUpdatedMessage)
}

// eslint-disable-next-line no-unused-vars -- 回调类型占位参数
export function onNoteUpdated(handler: (message: NoteUpdatedMessage) => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}

  const listener = (event: MessageEvent) => {
    const data = event.data as NoteUpdatedMessage
    if (data?.type === 'note-updated' && data.tabId !== TAB_ID) {
      handler(data)
    }
  }

  ch.addEventListener('message', listener)
  return () => ch.removeEventListener('message', listener)
}

const LOCK_TTL_MS = 5 * 60_000

function readLock(noteId: string): { tabId: string; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(LOCK_PREFIX + noteId)
    if (!raw) return null
    return JSON.parse(raw) as { tabId: string; timestamp: number }
  } catch {
    return null
  }
}

export function isNoteLockedByOtherTab(noteId: string): boolean {
  const lock = readLock(noteId)
  if (!lock) return false
  if (Date.now() - lock.timestamp >= LOCK_TTL_MS) return false
  return lock.tabId !== TAB_ID
}

export function acquireEditLock(noteId: string): void {
  localStorage.setItem(
    LOCK_PREFIX + noteId,
    JSON.stringify({ tabId: TAB_ID, timestamp: Date.now() })
  )
}

export function refreshEditLock(noteId: string): void {
  acquireEditLock(noteId)
}

export function releaseEditLock(noteId: string): void {
  const lock = readLock(noteId)
  if (lock?.tabId === TAB_ID) {
    localStorage.removeItem(LOCK_PREFIX + noteId)
  }
}
