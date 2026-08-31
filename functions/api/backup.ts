import { logToD1 } from '../_utils/log'
import { checkAuth } from '../_utils/auth'
import type { PagesFunction, D1Database } from '../types'
import { formatNotesToMarkdown, parseBackupToNotes } from '../../shared/backup.js'
import { fetchWebDAVBackup, uploadWebDAVBackup } from '../../shared/webdav.js'
import { ensureNotesTable, listNotesWithContent, replaceAllNotes } from '../../shared/d1-notes.js'
import { triggerPgSync } from '../_utils/pgSync'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequestPost: PagesFunction<{
  NOTESD: D1Database
  WEBDAV_URL: string
  WEBDAV_USER: string
  WEBDAV_PASS: string
}> = async (context) => {
  const { request, env } = context
  if (!(await checkAuth(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: apiCors(request, env),
    })
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  try {
    await ensureNotesTable(env.NOTESD)
    const notes = await listNotesWithContent(env.NOTESD)
    if (notes.length === 0) {
      await logToD1(env, 'warn', 'backup.upload.no_notes')
      return new Response(JSON.stringify({ success: false, error: '没有可导出的笔记' }), {
        status: 404,
        headers: apiCors(request, env),
      })
    }

    const content = formatNotesToMarkdown(notes)
    const { url, fileName } = await uploadWebDAVBackup({
      baseUrl: env.WEBDAV_URL,
      user: env.WEBDAV_USER,
      pass: env.WEBDAV_PASS,
      content,
    })

    await logToD1(env, 'info', 'backup.upload.success', {
      fileName,
      totalNotes: notes.length,
    })
    return new Response(
      JSON.stringify({
        success: true,
        url,
        fileName,
        totalNotes: notes.length,
        uploadTime: new Date(Date.now() + 8 * 60 * 60 * 1000)
          .toISOString()
          .replace('Z', '')
          .replace(/\.\d{3}$/, ''),
      }),
      { status: 200, headers: apiCors(request, env) }
    )
  } catch (e) {
    console.error('WebDAV 上传异常:', e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    await logToD1(env, 'error', 'backup.upload.exception', { message: errorMessage })
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}

export const onRequestGet: PagesFunction<{
  NOTESD: D1Database
  WEBDAV_URL: string
  WEBDAV_USER: string
  WEBDAV_PASS: string
}> = async (context) => {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  try {
    const fetched = await fetchWebDAVBackup({
      baseUrl: env.WEBDAV_URL,
      user: env.WEBDAV_USER,
      pass: env.WEBDAV_PASS,
    })

    if ('error' in fetched) {
      await logToD1(env, 'error', 'backup.download.failed', { status: fetched.status })
      return new Response(JSON.stringify({ success: false, error: fetched.error }), {
        status: fetched.status === null ? 500 : 502,
        headers: apiCors(request, env),
      })
    }

    const notes = parseBackupToNotes(fetched.text)
    if (notes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: '备份文件中没有找到笔记内容' }), {
        status: 400,
        headers: apiCors(request, env),
      })
    }

    await ensureNotesTable(env.NOTESD)
    const importedCount = await replaceAllNotes(env.NOTESD, notes)

    await logToD1(env, 'info', 'backup.download.success', {
      fileName: fetched.fileName,
      importedCount,
    })
    triggerPgSync(context)
    return new Response(
      JSON.stringify({
        success: true,
        message: '笔记已成功从云端下载并导入',
        fileName: fetched.fileName,
        importedCount,
        updatedCount: 0,
        totalNotes: notes.length,
      }),
      { status: 200, headers: apiCors(request, env) }
    )
  } catch (e: unknown) {
    console.error('WebDAV 下载异常:', e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    await logToD1(env, 'error', 'backup.download.exception', { message: errorMessage })
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
