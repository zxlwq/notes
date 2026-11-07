import { pool } from '../_utils/pg.js'
import { formatNotesToMarkdown, parseMarkdownToNotes } from '../../shared/backup.js'
import {
  createOrUpdateGist as createOrUpdateGistCore,
  fetchGist as fetchGistCore,
  getGistNotesContent,
} from '../../shared/gist.js'
import { createPgGistStore } from '../../shared/gist-store.js'
import { listNotesWithContent, replaceAllNotes } from '../../shared/pg-notes.js'

const store = createPgGistStore(pool)

export { getGistNotesContent }

export async function uploadNotesToGist(gitToken) {
  const notes = await listNotesWithContent(pool)
  if (notes.length === 0) {
    return { ok: false, error: '没有笔记可备份', status: 404 }
  }
  if (!gitToken) {
    return { ok: false, error: 'GitHub Token 未配置', status: 500 }
  }

  const gist = await createOrUpdateGistCore(gitToken, formatNotesToMarkdown(notes), store)
  return { ok: true, gistId: gist.id, totalNotes: notes.length }
}

export async function importNotesFromGist(gitToken) {
  if (!gitToken) {
    return { ok: false, error: 'GitHub Token 未配置', status: 500 }
  }

  const gistData = await fetchGistCore(gitToken, store)
  const text = getGistNotesContent(gistData)
  if (!text) {
    return { ok: false, error: 'Gist中没有找到笔记内容', status: 400 }
  }

  const notes = parseMarkdownToNotes(text)
  if (notes.length === 0) {
    return { ok: false, error: 'Gist文件中没有找到有效的笔记', status: 400 }
  }

  const importedCount = await replaceAllNotes(pool, notes)
  return { ok: true, importedCount, totalNotes: notes.length }
}
