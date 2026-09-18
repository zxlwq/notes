import { formatNotesToMarkdown, parseBackupToNotes } from '../../shared/backup.js'
import { getR2ConfigFromEnv, uploadToR2, downloadFromR2 } from '../../shared/r2.js'
import { listNotesWithContent, replaceAllNotes } from '../../shared/neon-notes.js'

/** @param {any} sql */
export async function uploadNotesToR2(sql, env) {
  const notes = await listNotesWithContent(sql)
  if (notes.length === 0) {
    return { ok: false, error: '没有可导出的笔记', status: 404 }
  }

  const r2Config = getR2ConfigFromEnv(env)
  await uploadToR2(formatNotesToMarkdown(notes), r2Config)
  return { ok: true, totalNotes: notes.length }
}

/** @param {any} sql */
export async function importNotesFromR2(sql, env, options = {}) {
  const r2Config = getR2ConfigFromEnv(env)
  const content = await downloadFromR2(r2Config)
  const parsedNotes = parseBackupToNotes(content)
  if (parsedNotes.length === 0) {
    return { ok: false, error: '备份文件中没有找到有效的笔记', status: 400 }
  }

  const { importedCount, updatedCount } = await replaceAllNotes(sql, parsedNotes, options)
  return {
    ok: true,
    importedCount,
    updatedCount,
    totalNotes: parsedNotes.length,
  }
}
