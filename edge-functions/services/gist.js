import { formatNotesToMarkdown, parseBackupToNotes } from '../../shared/backup.js'
import {
  createOrUpdateGist as createOrUpdateGistCore,
  fetchGist as fetchGistCore,
  getGistNotesContent,
} from '../../shared/gist.js'
import { createNeonGistStore } from '../../shared/gist-store.js'
import { listNotesWithContent, replaceAllNotes } from '../../shared/neon-notes.js'

export { getGistNotesContent }

/** @param {any} sql */
export async function uploadNotesToGist(sql, gitToken) {
  const notes = await listNotesWithContent(sql)
  if (notes.length === 0) {
    return { ok: false, error: '没有可导出的笔记', status: 404 }
  }
  if (!gitToken) {
    return { ok: false, error: 'GitHub Token 未配置', status: 500 }
  }

  const store = createNeonGistStore(sql)
  const gist = await createOrUpdateGistCore(gitToken, formatNotesToMarkdown(notes), store)
  return {
    ok: true,
    gistId: gist.id,
    totalNotes: notes.length,
  }
}

/** @param {any} sql */
export async function importNotesFromGist(sql, gitToken, options = {}) {
  if (!gitToken) {
    return { ok: false, error: 'GitHub Token 未配置', status: 500 }
  }

  const store = createNeonGistStore(sql)
  const gistData = await fetchGistCore(gitToken, store)
  const text = getGistNotesContent(gistData)
  if (!text) {
    return { ok: false, error: 'Gist中没有找到笔记内容', status: 400 }
  }

  const parsedNotes = parseBackupToNotes(text)
  if (parsedNotes.length === 0) {
    return { ok: false, error: 'Gist文件中没有找到有效的笔记', status: 400 }
  }

  const { importedCount, updatedCount } = await replaceAllNotes(sql, parsedNotes, options)
  return {
    ok: true,
    importedCount,
    updatedCount,
    totalNotes: parsedNotes.length,
  }
}
