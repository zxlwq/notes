export interface ParsedNote {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface NoteLike {
  id?: string
  title?: string
  content?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  created_at?: string
  updated_at?: string
}

export function formatNotesToMarkdown(notes: NoteLike[]): string
export function parseMarkdownToNotes(content: string): ParsedNote[]
export function parseBackupToNotes(content: string): ParsedNote[]
