import { notesApi } from '@/lib/api'
import {
  decryptContent,
  encryptContent,
  encryptTags,
  encryptField,
  decryptField,
  decryptTags,
  isEncryptedContent,
} from '@/lib/crypto'
import type { Note } from '@/types'

async function decryptNote(note: Note, password: string): Promise<Note> {
  const result = { ...note }
  if (note.title && isEncryptedContent(note.title)) {
    result.title = await decryptField(note.title, password)
  }
  if (note.tags) {
    result.tags = await decryptTags(
      note.tags.length === 1 && isEncryptedContent(note.tags[0])
        ? note.tags[0]
        : JSON.stringify(note.tags),
      password
    )
  }
  if (note.content && isEncryptedContent(note.content)) {
    result.content = await decryptContent(note.content, password)
  }
  return result
}

export async function reencryptAllNotes(oldPassword: string, newPassword: string): Promise<void> {
  const { data: summaries } = await notesApi.getNotes()

  for (const summary of summaries) {
    const { data: raw } = await notesApi.getNoteRaw(summary.id)
    const plain = await decryptNote(raw, oldPassword)

    await notesApi.updateNoteRaw(summary.id, {
      title: await encryptField(plain.title, newPassword),
      tags: [await encryptTags(plain.tags, newPassword)],
      ...(plain.content !== undefined
        ? { content: await encryptContent(plain.content, newPassword) }
        : {}),
    })
  }
}
