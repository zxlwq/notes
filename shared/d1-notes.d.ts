import type { ParsedNote } from './backup.js'

export interface D1DatabaseLike {
  exec(sql: string): Promise<unknown>
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>
      first<T = unknown>(): Promise<T | null>
      run(): Promise<{ meta?: { changes?: number } }>
    }
    run(): Promise<unknown>
  }
}

export interface NoteSummary {
  id: string
  title: string
  tags: string[]
  createdAt: string
  updatedAt: string
  contentLength: number
}

export function ensureNotesTable(db: D1DatabaseLike): Promise<void>
export function listNoteSummaries(db: D1DatabaseLike): Promise<NoteSummary[]>
export function listNoteSummariesPage(
  db: D1DatabaseLike,
  page: number,
  limit: number
): Promise<{ items: NoteSummary[]; total: number; page: number; limit: number; hasMore: boolean }>
export function listNotesWithContent(db: D1DatabaseLike): Promise<ParsedNote[]>
export function getNoteById(db: D1DatabaseLike, id: string): Promise<ParsedNote | null>
export function noteExists(db: D1DatabaseLike, id: string): Promise<boolean>
export function upsertDefaultNote(db: D1DatabaseLike, content: string): Promise<void>
export function createNote(
  db: D1DatabaseLike,
  note: {
    id?: string
    title: string
    content: string
    tags?: string[]
    createdAt?: string
    updatedAt?: string
  }
): Promise<string>
export function upsertNote(db: D1DatabaseLike, note: unknown): Promise<string>
export function updateNote(
  db: D1DatabaseLike,
  id: string,
  note: { title: string; content: string; tags?: string[] }
): Promise<boolean>
export function deleteNote(db: D1DatabaseLike, id: string): Promise<boolean>
export function deleteAllNotes(db: D1DatabaseLike): Promise<void>
export function importNotes(db: D1DatabaseLike, notes: unknown[]): Promise<number>
export function replaceAllNotes(db: D1DatabaseLike, notes: unknown[]): Promise<number>
