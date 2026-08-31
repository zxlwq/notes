import { pool } from '../_utils/pg.js'
import { formatNotesToMarkdown, parseMarkdownToNotes } from '../../shared/backup.js'
import { getR2ConfigFromEnv, uploadToR2, downloadFromR2 } from '../../shared/r2.js'
import { listNotesWithContent, replaceAllNotes } from '../../shared/pg-notes.js'

const r2Config = () =>
  getR2ConfigFromEnv({
    ACCOUNT_ID: process.env.ACCOUNT_ID,
    ACCESS_KEY_ID: process.env.ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.SECRET_ACCESS_KEY,
  })

export async function uploadNotesToR2() {
  const notes = await listNotesWithContent(pool)
  if (notes.length === 0) {
    return { ok: false, error: '没有笔记可备份', status: 404 }
  }

  await uploadToR2(formatNotesToMarkdown(notes), r2Config())
  return { ok: true, totalNotes: notes.length }
}

export async function importNotesFromR2() {
  const content = await downloadFromR2(r2Config())
  const notes = parseMarkdownToNotes(content)
  if (notes.length === 0) {
    return { ok: false, error: '备份文件中没有找到有效的笔记', status: 400 }
  }

  const importedCount = await replaceAllNotes(pool, notes)
  return { ok: true, importedCount, totalNotes: notes.length }
}
