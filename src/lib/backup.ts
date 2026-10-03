import { notesApi } from '@/lib/api'
import {
  decryptContent,
  decryptField,
  decryptTags,
  encryptContent,
  encryptField,
  encryptTags,
  getEncryptionPassword,
  isEncryptedContent,
} from '@/lib/crypto'
import type { Note } from '@/types'

type ImportNoteItem = {
  id?: string
  title?: string
  content?: string
  tags?: string[] | string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  [key: string]: unknown
}

function isEncryptedTags(tags: string[] | undefined): boolean {
  return Boolean(tags?.length === 1 && tags[0] && isEncryptedContent(tags[0]))
}

function normalizeTags(raw: string[] | string | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String) : [raw]
    } catch {
      return [raw]
    }
  }
  return []
}

export async function decryptNoteFields(
  note: ImportNoteItem,
  password?: string | null
): Promise<Note> {
  const pwd = password ?? getEncryptionPassword()
  const tags = normalizeTags(note.tags)
  const result: Note = {
    id: String(note.id ?? ''),
    title: String(note.title ?? ''),
    content: String(note.content ?? ''),
    tags,
    createdAt: String(note.createdAt ?? note.created_at ?? new Date().toISOString()),
    updatedAt: String(note.updatedAt ?? note.updated_at ?? new Date().toISOString()),
  }

  if (!pwd) return result

  if (result.title && isEncryptedContent(result.title)) {
    result.title = await decryptField(result.title, pwd)
  }

  if (tags.length) {
    const tagsSource =
      tags.length === 1 && isEncryptedContent(tags[0]) ? tags[0] : JSON.stringify(tags)
    result.tags = await decryptTags(tagsSource, pwd)
  }

  if (result.content && isEncryptedContent(result.content)) {
    result.content = await decryptContent(result.content, pwd)
  }

  return result
}

export async function prepareNoteForStorage(
  note: ImportNoteItem,
  password?: string | null
): Promise<ImportNoteItem> {
  const pwd = password ?? getEncryptionPassword()
  if (!pwd) return note

  const result = { ...note }
  const tags = normalizeTags(note.tags)

  if (note.title && typeof note.title === 'string' && !isEncryptedContent(note.title)) {
    result.title = await encryptField(note.title, pwd)
  }

  if (tags.length && !isEncryptedTags(tags)) {
    result.tags = [await encryptTags(tags, pwd)]
  }

  if (note.content && typeof note.content === 'string' && !isEncryptedContent(note.content)) {
    result.content = await encryptContent(note.content, pwd)
  }

  return result
}

export function parseImportNotesJson(text: string): ImportNoteItem[] {
  const parsed = JSON.parse(text) as unknown
  if (Array.isArray(parsed)) return parsed as ImportNoteItem[]
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { notes?: unknown }).notes)
  ) {
    return (parsed as { notes: ImportNoteItem[] }).notes
  }
  throw new Error('Invalid JSON import format')
}

export async function buildImportPreview(text: string, isJson: boolean): Promise<string> {
  if (!isJson) {
    return text.substring(0, 200) + (text.length > 200 ? '...' : '')
  }

  const password = getEncryptionPassword()
  try {
    const items = parseImportNotesJson(text)
    if (!password) {
      return text.substring(0, 200) + (text.length > 200 ? '...' : '')
    }

    const previewItems = items.slice(0, 3)
    const decrypted = await Promise.all(
      previewItems.map((item) => decryptNoteFields(item, password))
    )
    const preview = decrypted.map((n) => ({
      title: n.title,
      tags: n.tags,
      content: n.content?.substring(0, 80),
    }))
    const suffix = items.length > 3 ? `\n... 共 ${items.length} 条` : ''
    return JSON.stringify(preview, null, 2) + suffix
  } catch {
    return text.substring(0, 200) + (text.length > 200 ? '...' : '')
  }
}

export async function fetchNotesForExport(summaries: Note[]): Promise<Note[]> {
  if (!summaries.length) return []

  const password = getEncryptionPassword()
  if (!password) {
    throw new Error('请先登录并输入密码后再导出')
  }

  const fullNotes = await Promise.all(
    summaries.map(async (summary) => {
      const res = await notesApi.getNote(summary.id)
      return res.data
    })
  )

  return fullNotes
}

export function notesToMarkdown(notes: Note[]): string {
  return notes
    .map((note) => {
      const tags = note.tags?.length ? note.tags.join(', ') : ''
      const meta = [
        tags ? `标签: ${tags}` : '',
        note.createdAt ? `创建时间: ${note.createdAt}` : '',
        note.updatedAt ? `更新时间: ${note.updatedAt}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      return `# ${note.title || '无标题'}${meta ? `\n${meta}` : ''}\n\n${note.content ?? ''}`
    })
    .join('\n\n---\n\n')
}

export function notesToPlainText(notes: Note[]): string {
  return notes
    .map((note) => `${note.title || '无标题'}\n\n${note.content ?? ''}`)
    .join(`\n\n${'='.repeat(50)}\n\n`)
}

export async function prepareImportPayload(
  content: string,
  format: 'json' | 'markdown' | 'text'
): Promise<ImportNoteItem[]> {
  const password = getEncryptionPassword()

  if (format === 'json') {
    const items = parseImportNotesJson(content)
    return Promise.all(items.map((item) => prepareNoteForStorage(item, password)))
  }

  let items: ImportNoteItem[]
  try {
    const parsed = JSON.parse(content) as unknown
    if (Array.isArray(parsed)) {
      items = parsed as ImportNoteItem[]
    } else {
      items = [
        {
          id: Date.now().toString(),
          title: '导入的笔记',
          content,
          tags: ['导入'],
        },
      ]
    }
  } catch {
    items = [
      {
        id: Date.now().toString(),
        title: '导入的笔记',
        content,
        tags: ['导入'],
      },
    ]
  }

  return Promise.all(items.map((item) => prepareNoteForStorage(item, password)))
}

export function noteHasEncryptedFields(note: ImportNoteItem): boolean {
  const tags = normalizeTags(note.tags)
  return (
    Boolean(note.title && isEncryptedContent(String(note.title))) ||
    Boolean(note.content && isEncryptedContent(String(note.content))) ||
    isEncryptedTags(tags)
  )
}
