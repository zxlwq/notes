import { AxiosResponse } from 'axios'
import {
  decryptContent,
  encryptContent,
  encryptField,
  decryptField,
  encryptTags,
  decryptTags,
  getEncryptionPassword,
  isEncryptedContent,
} from '@/lib/crypto'
import { api } from '@/lib/client'
import { prepareImportPayload } from '@/lib/backup'
import { findCachedNote } from '@/lib/notes'
import {
  getOfflineNote,
  getOfflineNotesPage,
  isNetworkUnavailable,
  mergeOfflineSummaries,
  removeOfflineNote,
  saveOfflineNote,
} from '@/lib/offline'
import { offlineCreateNote, offlineDeleteNote, offlineUpdateNote } from '@/lib/offlineSync'
import { loadNoteFromSearchIndex } from '@/lib/searchIdx'
import { upsertSearchIndexEntry } from '@/lib/search'
import type {
  ApiResponse,
  Note,
  NotesListResponse,
  NoteCreateRequest,
  NoteUpdateRequest,
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
  PasswordStatusResponse,
  ImportRequest,
  CloudBackup,
} from '@/types'

export { api } from '@/lib/client'

async function decryptNote(note: Note, password: string): Promise<Note> {
  const result = { ...note }
  if (note.title && isEncryptedContent(note.title)) {
    result.title = await decryptField(note.title, password)
  }
  if (note.tags?.length) {
    const tagsSource =
      note.tags.length === 1 && isEncryptedContent(note.tags[0])
        ? note.tags[0]
        : JSON.stringify(note.tags)
    result.tags = await decryptTags(tagsSource, password)
  }
  if (note.content) {
    if (isEncryptedContent(note.content)) {
      result.content = await decryptContent(note.content, password)
    }
  }
  return result
}

async function encryptNotePayload(
  note: NoteUpdateRequest,
  password: string
): Promise<NoteUpdateRequest> {
  const payload = { ...note }
  if (payload.title) {
    payload.title = await encryptField(payload.title, password)
  }
  if (payload.tags?.length) {
    payload.tags = [await encryptTags(payload.tags, password)]
  }
  if (payload.content) {
    payload.content = await encryptContent(payload.content, password)
  }
  return payload
}

async function maybeMigratePlaintext(note: Note, password: string): Promise<void> {
  const needsTitle = note.title && !isEncryptedContent(note.title)
  const needsTags =
    note.tags?.length && !(note.tags.length === 1 && isEncryptedContent(note.tags[0]))
  const needsContent = note.content && !isEncryptedContent(note.content)
  if (!needsTitle && !needsTags && !needsContent) return

  const encrypted = await encryptNotePayload(
    {
      title: note.title,
      tags: note.tags,
      ...(note.content !== undefined ? { content: note.content } : {}),
    },
    password
  )
  void api.put(`/api/notes/${note.id}`, encrypted)
}

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse<T>['config'],
  }
}

type RemoteSaveOptions = {
  remoteOnly?: boolean
}

function assertRemoteSaveResponse(
  response: AxiosResponse<ApiResponse>,
  options?: { requireId?: boolean }
): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error('服务器保存失败')
  }
  if (!response.data?.success) {
    throw new Error(response.data?.error || '服务器保存失败')
  }
  if (options?.requireId && !response.data?.id) {
    throw new Error('服务器未返回笔记 ID')
  }
}

async function persistFetchedNote(note: Note) {
  void saveOfflineNote(note)
  void upsertSearchIndexEntry(note)
}

export const notesApi = {
  getNotes: async (): Promise<AxiosResponse<Note[]>> => {
    const response = await api.get<Note[]>('/api/notes')
    const password = getEncryptionPassword()
    if (password && Array.isArray(response.data)) {
      response.data = await Promise.all(response.data.map((n) => decryptNote(n, password)))
    }
    void mergeOfflineSummaries(response.data)
    return response
  },

  getNotesPage: async (page = 1, limit = 30): Promise<AxiosResponse<NotesListResponse>> => {
    if (!navigator.onLine) {
      return okResponse(await getOfflineNotesPage(page, limit))
    }

    try {
      const response = await api.get<NotesListResponse>('/api/notes', { params: { page, limit } })
      const password = getEncryptionPassword()
      if (password && response.data?.items) {
        response.data.items = await Promise.all(
          response.data.items.map((n) => decryptNote(n, password))
        )
      }
      void mergeOfflineSummaries(response.data.items)
      return response
    } catch (err: unknown) {
      if (isNetworkUnavailable(err)) {
        return okResponse(await getOfflineNotesPage(page, limit))
      }
      throw err
    }
  },

  getAllSummaries: async (): Promise<Note[]> => {
    const all: Note[] = []
    let page = 1
    const limit = 100
    while (true) {
      const { data } = await notesApi.getNotesPage(page, limit)
      all.push(...data.items)
      if (!data.hasMore) break
      page += 1
    }
    return all
  },

  getNoteRaw: (id: string): Promise<AxiosResponse<Note>> => api.get<Note>(`/api/notes/${id}`),

  getNote: async (id: string): Promise<AxiosResponse<Note>> => {
    const readLocal = async (): Promise<Note | null> => {
      const offline = await getOfflineNote(id)
      if (offline?.content != null && offline.content !== '') return offline
      const summary =
        findCachedNote(id) ??
        ({ id, title: '', tags: [], createdAt: '', updatedAt: '', contentLength: 0 } as Note)
      return loadNoteFromSearchIndex(summary)
    }

    if (!navigator.onLine) {
      const local = await readLocal()
      if (local) return okResponse(local)
      throw new Error('当前离线，且无本地缓存的正文')
    }

    try {
      const response = await api.get<Note>(`/api/notes/${id}`)
      const password = getEncryptionPassword()
      if (password && response.data) {
        const raw = { ...response.data }
        response.data = await decryptNote(response.data, password)
        void maybeMigratePlaintext(raw, password)
      }
      if (response.data) void persistFetchedNote(response.data)
      return response
    } catch (err: unknown) {
      if (isNetworkUnavailable(err)) {
        const local = await readLocal()
        if (local) return okResponse(local)
      }
      throw err
    }
  },

  createNote: async (
    note: NoteCreateRequest,
    options?: RemoteSaveOptions
  ): Promise<AxiosResponse<ApiResponse<{ id: string }>>> => {
    const buildFull = (): Note => ({
      id: note.id ?? Date.now().toString(),
      title: note.title,
      content: note.content,
      tags: note.tags ?? [],
      createdAt: note.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const saveLocal = async () => {
      const full = buildFull()
      const { id } = await offlineCreateNote(full)
      return okResponse<ApiResponse<{ id: string }>>({ success: true, id })
    }

    const password = getEncryptionPassword()
    const encrypted = password ? await encryptNotePayload(note, password) : { ...note }
    const body = {
      ...encrypted,
      ...(note.id ? { id: note.id } : {}),
      ...(note.createdAt ? { createdAt: note.createdAt } : {}),
    }

    if (options?.remoteOnly) {
      if (!navigator.onLine) {
        throw new Error('当前无网络连接，无法保存到服务器')
      }
      const response = await api.post<ApiResponse<{ id: string }>>('/api/notes', body)
      assertRemoteSaveResponse(response, { requireId: true })
      const full = buildFull()
      full.id = response.data?.id ?? full.id
      void persistFetchedNote(full)
      return response
    }

    if (!navigator.onLine) return saveLocal()

    try {
      const response = await api.post<ApiResponse<{ id: string }>>('/api/notes', body)
      assertRemoteSaveResponse(response, { requireId: true })
      const full = buildFull()
      full.id = response.data?.id ?? full.id
      void persistFetchedNote(full)
      return response
    } catch (err: unknown) {
      if (isNetworkUnavailable(err)) return saveLocal()
      throw err
    }
  },

  updateNote: async (
    id: string,
    note: NoteUpdateRequest,
    options?: RemoteSaveOptions
  ): Promise<AxiosResponse<ApiResponse>> => {
    const saveLocal = async () => {
      const existing = (await getOfflineNote(id)) ?? findCachedNote(id)
      const merged: Note = {
        id,
        title: note.title ?? existing?.title ?? '',
        content: note.content ?? existing?.content ?? '',
        tags: note.tags ?? existing?.tags ?? [],
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await offlineUpdateNote(merged)
      return okResponse<ApiResponse>({ success: true })
    }

    const password = getEncryptionPassword()
    const payload = password ? await encryptNotePayload(note, password) : note

    if (options?.remoteOnly) {
      if (!navigator.onLine) {
        throw new Error('当前无网络连接，无法保存到服务器')
      }
      const response = await api.put<ApiResponse>(`/api/notes/${id}`, payload)
      assertRemoteSaveResponse(response)
      const existing = await getOfflineNote(id)
      const merged: Note = {
        id,
        title: note.title ?? existing?.title ?? '',
        content: note.content ?? existing?.content ?? '',
        tags: note.tags ?? existing?.tags ?? [],
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      void persistFetchedNote(merged)
      return response
    }

    if (!navigator.onLine) return saveLocal()

    try {
      const response = await api.put<ApiResponse>(`/api/notes/${id}`, payload)
      assertRemoteSaveResponse(response)
      const existing = await getOfflineNote(id)
      const merged: Note = {
        id,
        title: note.title ?? existing?.title ?? '',
        content: note.content ?? existing?.content ?? '',
        tags: note.tags ?? existing?.tags ?? [],
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      void persistFetchedNote(merged)
      return response
    } catch (err: unknown) {
      if (isNetworkUnavailable(err)) return saveLocal()
      throw err
    }
  },

  updateNoteRaw: (id: string, note: NoteUpdateRequest): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/api/notes/${id}`, note),

  deleteNote: async (id: string): Promise<AxiosResponse<ApiResponse>> => {
    const saveLocal = async () => {
      await offlineDeleteNote(id)
      return okResponse<ApiResponse>({ success: true })
    }

    if (!navigator.onLine) return saveLocal()

    try {
      const response = await api.delete<ApiResponse>(`/api/notes/${id}`)
      await removeOfflineNote(id)
      return response
    } catch (err: unknown) {
      if (isNetworkUnavailable(err)) return saveLocal()
      throw err
    }
  },

  importNotes: async (request: ImportRequest): Promise<AxiosResponse<ApiResponse>> => {
    if (!request.content) {
      return api.post('/api/import', { notes: [] })
    }

    try {
      const format =
        request.format === 'json' ? 'json' : request.format === 'text' ? 'text' : 'markdown'
      const notes = await prepareImportPayload(request.content, format)
      return api.post('/api/import', { notes })
    } catch {
      return api.post('/api/import', { notes: [] })
    }
  },

  updateNotes: async (content: string): Promise<AxiosResponse<ApiResponse>> => {
    const password = getEncryptionPassword()
    const payload = password ? await encryptContent(content, password) : content
    return api.post('/api/notes', { content: payload })
  },
}

export interface SessionResponse {
  authenticated: boolean
}

export interface RecoveryStatusResponse {
  configured: boolean
}

export interface RecoverySetupResponse {
  success: boolean
  recoveryCode?: string
}

export const authApi = {
  login: (request: LoginRequest): Promise<AxiosResponse<LoginResponse>> =>
    api.post('/api/login', request),

  logout: (): Promise<AxiosResponse<ApiResponse>> => api.post('/api/logout'),

  getSession: (): Promise<AxiosResponse<SessionResponse>> => api.get('/api/session'),

  changePassword: (request: ChangePasswordRequest): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/api/password', request),

  getPasswordStatus: (): Promise<AxiosResponse<PasswordStatusResponse>> =>
    api.get('/api/password/status'),

  getRecoveryStatus: (): Promise<AxiosResponse<RecoveryStatusResponse>> =>
    api.get('/api/recovery/status'),

  setupRecovery: (): Promise<AxiosResponse<RecoverySetupResponse>> =>
    api.post('/api/recovery/setup'),

  resetWithRecovery: (
    recoveryCode: string,
    newPassword: string
  ): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/api/recovery/reset', { recoveryCode, newPassword }),
}

export const cloudApi = {
  uploadToCloud: (): Promise<AxiosResponse<ApiResponse>> => api.post('/api/backup'),

  downloadFromCloud: (): Promise<AxiosResponse<CloudBackup>> => api.get('/api/backup'),
}

export const gistApi = {
  uploadToGist: (): Promise<AxiosResponse<ApiResponse>> => api.post('/api/gist'),

  downloadFromGist: (): Promise<AxiosResponse<CloudBackup>> => api.get('/api/gist'),
}

export const r2Api = {
  uploadToR2: (): Promise<AxiosResponse<ApiResponse>> => api.post('/api/r2'),

  downloadFromR2: (): Promise<AxiosResponse<CloudBackup>> => api.get('/api/r2'),
}

export interface LogEntry {
  id: string
  level: string
  message: string
  meta?: string
  created_at: string
}

export interface LogsResponse {
  success: boolean
  logs?: LogEntry[]
}

export const logsApi = {
  getLogs: (): Promise<AxiosResponse<LogsResponse>> => api.get('/api/logs'),
  clearLogs: (): Promise<AxiosResponse<ApiResponse>> => api.delete('/api/logs'),
}

export type OrderData = string[] | { [key: string]: unknown }

export const orderApi = {
  getOrder: (key: string): Promise<AxiosResponse<{ success: boolean; data: OrderData | null }>> =>
    api.get(`/api/order/${key}`),

  saveOrder: (key: string, data: OrderData): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/api/order/${key}`, data),
}
