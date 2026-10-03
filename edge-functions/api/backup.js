import { neon } from '@neondatabase/serverless'
import { logError, logToDatabase } from '../_utils/log.js'
import { trace } from '../_utils/logger.js'
import { checkAuth, unauthorizedResponse } from '../_utils/auth.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'
import { parseBackupToNotes } from '../../shared/backup.js'
import { fetchWebDAVBackup } from '../../shared/webdav.js'
import { exportNotesBackup, replaceAllNotes } from '../services/neonNotes.js'

export default async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  trace(env, '[BACKUP] Request method:', method)

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  try {
    const sql = neon(env.DATABASE_URL)

    if (method === 'POST') {
      trace(env, '[BACKUP] Creating backup from Neon database')
      try {
        const backupData = await exportNotesBackup(sql)
        trace(env, '[BACKUP] Backup created successfully, notes count:', backupData.notes.length)
        try {
          await logToDatabase(env, 'info', 'backup:post:success', {
            count: backupData.notes.length,
          })
        } catch {}
        return new Response(
          JSON.stringify({
            success: true,
            message: '备份创建成功',
            fileName: 'notes.md',
            totalNotes: backupData.notes.length,
            data: backupData,
          }),
          { status: 200, headers: apiCors(request, env) }
        )
      } catch (dbError) {
        console.error('[BACKUP] Database backup failed:', dbError)
        logError('backup:post:error', { message: dbError?.message }, env)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Database backup failed',
            details: dbError.message,
          }),
          { status: 500, headers: apiCors(request, env) }
        )
      }
    }

    if (method === 'DELETE') {
      trace(env, '[BACKUP] Clearing all notes from database')
      try {
        const countResult = await sql`SELECT COUNT(*) as count FROM notes`
        const currentCount = countResult[0]?.count || 0
        await sql`DELETE FROM notes`
        trace(env, `[BACKUP] Cleared ${currentCount} notes from database`)
        try {
          await logToDatabase(env, 'info', 'backup:clear:success', { clearedCount: currentCount })
        } catch {}
        return new Response(
          JSON.stringify({
            success: true,
            message: `已清空 ${currentCount} 条笔记`,
            clearedCount: currentCount,
          }),
          { status: 200, headers: apiCors(request, env) }
        )
      } catch (dbError) {
        console.error('[BACKUP] Failed to clear notes:', dbError)
        await logError('backup:clear:error', { message: dbError?.message }, env)
        return new Response(
          JSON.stringify({ success: false, error: '清理笔记失败', details: dbError?.message }),
          { status: 500, headers: apiCors(request, env) }
        )
      }
    }

    if (method === 'GET') {
      trace(env, '[BACKUP] Downloading notes from WebDAV and importing to Neon')
      try {
        const fetched = await fetchWebDAVBackup({
          baseUrl: env.WEBDAV_URL,
          user: env.WEBDAV_USER,
          pass: env.WEBDAV_PASS,
        })

        if ('error' in fetched) {
          await logError(
            'backup:download:error',
            { message: fetched.error, status: fetched.status },
            env
          )
          return new Response(
            JSON.stringify({
              success: false,
              error: 'WebDAV fetch failed',
              status: fetched.status,
            }),
            { status: 502, headers: apiCors(request, env) }
          )
        }

        const parsedNotes = parseBackupToNotes(fetched.text)
        trace(env, '[BACKUP] Parsed notes count:', parsedNotes.length)

        if (parsedNotes.length === 0) {
          await logError(
            'backup:download:error',
            { message: 'No notes parsed from WebDAV content' },
            env
          )
          return new Response(
            JSON.stringify({ success: false, error: 'No notes found in WebDAV file' }),
            {
              status: 400,
              headers: apiCors(request, env),
            }
          )
        }

        try {
          await sql`SELECT 1 as test`
        } catch (dbTestError) {
          await logError(
            'backup:download:error',
            { message: 'Database connection test failed', details: dbTestError.message },
            env
          )
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Database connection failed',
              details: dbTestError.message,
            }),
            { status: 500, headers: apiCors(request, env) }
          )
        }

        const { importedCount, updatedCount } = await replaceAllNotes(sql, parsedNotes, {
          onTrace: (msg) => trace(env, '[BACKUP]', msg),
        })

        try {
          await logToDatabase(env, 'info', 'backup:download:success', {
            fileName: fetched.fileName,
            importedCount,
            updatedCount,
          })
        } catch {}
        return new Response(
          JSON.stringify({
            success: true,
            fileName: fetched.fileName,
            importedCount,
            updatedCount,
          }),
          { status: 200, headers: apiCors(request, env) }
        )
      } catch (err) {
        console.error('[BACKUP] WebDAV download/import failed:', err)
        logError('backup:download:error', { message: err?.message }, env)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'WebDAV download/import failed',
            details: err?.message,
          }),
          { status: 500, headers: apiCors(request, env) }
        )
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  } catch (error) {
    console.error('Backup error:', error)
    logError('backup:unhandled', { message: error?.message }, env)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
