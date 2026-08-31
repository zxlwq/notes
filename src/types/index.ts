export interface ApiResponse<T = unknown> {
  success?: boolean
  error?: string
  data?: T
  id?: string
  imported?: number
  fileName?: string
  totalNotes?: number
}

export interface Note {
  id: string
  title: string
  /** 仅详情接口返回；列表接口不返回正文 */
  content?: string
  /** 列表接口返回的字数，不含正文内容 */
  contentLength?: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface NotesListResponse {
  items: Note[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface LoginRequest {
  password: string
}

export interface LoginResponse {
  success: boolean
  token?: string
  error?: string
}

export interface AppSettings {
  fontSize: string
  backgroundImageUrl: string
  logoUrl: string
  fontFamily: string
  username: string
  autoLock: boolean
  lockTimeout: string
  /** 列表页静默刷新间隔 */
  listRefreshInterval: string
}

export interface SearchOptions {
  useRegex?: boolean
  caseSensitive?: boolean
  searchInTitle?: boolean
  searchInContent?: boolean
  searchInTags?: boolean
}

export interface SearchHistory {
  query: string
  timestamp: number
}

export interface DebounceOptions {
  leading?: boolean
  trailing?: boolean
}

export interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface PasswordStatusResponse {
  source: 'd1' | 'env' | 'postgresql'
  hasPassword: boolean
  usingD1?: boolean
  usingPostgreSQL?: boolean
  passwordSource?: 'd1' | 'env' | 'postgresql'
}

export interface ImportRequest {
  content: string
  format: ImportFormat
}

export type ImportFormat = 'markdown' | 'text' | 'json'

export interface CloudBackup {
  success: boolean
  url?: string
  fileName?: string
  totalNotes?: number
  uploadTime?: string
  error?: string
  importedCount?: number
  updatedCount?: number
  message?: string
  gistId?: string
}

export interface NoteCreateRequest {
  id?: string
  title: string
  content: string
  tags?: string[]
  createdAt?: string
}

export interface NoteUpdateRequest {
  title?: string
  content?: string
  tags?: string[]
}

export interface SettingsChangedEvent extends CustomEvent {
  detail: AppSettings
}

export interface NotesImportedEvent extends CustomEvent {
  detail: {
    count: number
    format: ImportFormat
  }
}
