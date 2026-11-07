import { neon } from '@neondatabase/serverless'
import { logError, logToDatabase } from '../_utils/log.js'
import { trace } from '../_utils/logger.js'
import { checkAuth, unauthorizedResponse } from '../_utils/auth.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'
import { importNotesFromR2, uploadNotesToR2 } from '../services/r2.js'

export default async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  const sql = neon(env.DATABASE_URL)

  try {
    if (method === 'POST') {
      trace(env, '[R2] Uploading notes to R2 from Neon database')
      const result = await uploadNotesToR2(sql, env)
      if (!result.ok) {
        await logToDatabase(env, result.status === 404 ? 'warn' : 'error', 'r2:post:failed', {
          error: result.error,
        })
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: result.status,
          headers: apiCors(request, env),
        })
      }

      await logToDatabase(env, 'info', 'r2:post:success', { count: result.totalNotes })
      return new Response(
        JSON.stringify({
          success: true,
          message: '成功上传到R2',
          fileName: 'notes.md',
          totalNotes: result.totalNotes,
        }),
        { status: 200, headers: apiCors(request, env) }
      )
    }

    if (method === 'GET') {
      trace(env, '[R2] Downloading notes from R2 and importing to Neon')
      const result = await importNotesFromR2(sql, env, {
        onTrace: (msg) => trace(env, '[R2]', msg),
      })
      if (!result.ok) {
        await logToDatabase(env, 'error', 'r2:get:failed', { error: result.error })
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: result.status,
          headers: apiCors(request, env),
        })
      }

      await logToDatabase(env, 'info', 'r2:get:success', { importedCount: result.importedCount })
      return new Response(
        JSON.stringify({
          success: true,
          fileName: 'notes.md',
          importedCount: result.importedCount,
          updatedCount: result.updatedCount,
        }),
        { status: 200, headers: apiCors(request, env) }
      )
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: apiCors(request, env),
    })
  } catch (error) {
    console.error('R2 error:', error)
    logError('r2:unhandled', { message: error?.message }, env)
    return new Response(
      JSON.stringify({ success: false, error: 'R2下载/导入失败', details: error?.message }),
      { status: 500, headers: apiCors(request, env) }
    )
  }
}
