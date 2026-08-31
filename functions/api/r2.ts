import { logToD1 } from '../_utils/log'
import type { PagesFunction, D1Database, R2Bucket } from '../types'
import { parseBackupToNotes, formatNotesToMarkdown } from '../../shared/backup.js'
import { listNotesWithContent, replaceAllNotes } from '../../shared/d1-notes.js'
import { triggerPgSync } from '../_utils/pgSync'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequestPost: PagesFunction<{ NOTESD: D1Database; NOTESR: R2Bucket }> = async (
  context
) => {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  try {
    const notes = await listNotesWithContent(env.NOTESD)
    if (notes.length === 0) {
      await logToD1(env, 'warn', 'r2.upload.no_notes')
      return Response.json(
        { success: false, error: '没有可导出的笔记' },
        { status: 404, headers: apiCors(request, env) }
      )
    }

    const bucket = env.NOTESR
    if (!bucket) {
      await logToD1(env, 'error', 'r2.upload.no_bucket')
      return Response.json(
        { success: false, error: 'R2存储桶未配置' },
        { status: 500, headers: apiCors(request, env) }
      )
    }

    const content = formatNotesToMarkdown(notes)
    const filename = 'notes.md'
    await bucket.put(filename, content, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      customMetadata: { uploadedAt: new Date().toISOString(), notesCount: String(notes.length) },
    })

    await logToD1(env, 'info', 'r2.upload.success', {
      fileName: filename,
      totalNotes: notes.length,
    })
    return Response.json(
      {
        success: true,
        fileName: filename,
        totalNotes: notes.length,
        uploadTime: new Date(Date.now() + 8 * 60 * 60 * 1000)
          .toISOString()
          .replace('Z', '')
          .replace(/\.\d{3}$/, ''),
      },
      { headers: apiCors(request, env) }
    )
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    await logToD1(env, 'error', 'r2.upload.exception', { message: errorMessage })
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500, headers: apiCors(request, env) }
    )
  }
}

export const onRequestGet: PagesFunction<{ NOTESD: D1Database; NOTESR: R2Bucket }> = async (
  context
) => {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  const bucket = env.NOTESR
  if (!bucket) {
    await logToD1(env, 'error', 'r2.download.no_bucket')
    return Response.json(
      { success: false, error: 'R2存储桶未配置' },
      { status: 500, headers: apiCors(request, env) }
    )
  }

  try {
    const filename = 'notes.md'
    const object = await bucket.get(filename)
    if (!object) {
      await logToD1(env, 'error', 'r2.download.not_found')
      return Response.json(
        { success: false, error: 'R2中未找到备份文件' },
        { status: 404, headers: apiCors(request, env) }
      )
    }

    const notes = parseBackupToNotes(await object.text())
    if (notes.length === 0) {
      await logToD1(env, 'error', 'r2.download.no_notes')
      return Response.json(
        { success: false, error: '备份文件中没有找到有效的笔记' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const importedCount = await replaceAllNotes(env.NOTESD, notes)
    await logToD1(env, 'info', 'r2.download.success', { fileName: filename, importedCount })
    triggerPgSync(context)
    return Response.json(
      {
        success: true,
        message: '成功从R2导入',
        fileName: filename,
        importedCount,
        updatedCount: 0,
        totalNotes: notes.length,
      },
      { headers: apiCors(request, env) }
    )
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    await logToD1(env, 'error', 'r2.download.exception', { message: errorMessage })
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500, headers: apiCors(request, env) }
    )
  }
}
