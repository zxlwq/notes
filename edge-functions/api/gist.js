import { neon } from '@neondatabase/serverless'
import { logError, logToDatabase } from '../_utils/log.js'
import { trace } from '../_utils/logger.js'
import { checkAuth, unauthorizedResponse } from '../_utils/auth.js'
import { apiCors, apiPreflight } from '../_utils/cors.js'
import { importNotesFromGist, uploadNotesToGist } from '../services/gist.js'

export default async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: apiPreflight(request, env) })
  }

  if (!(await checkAuth(request, env))) {
    return unauthorizedResponse(request, env)
  }

  const gitToken = env.GIT_TOKEN || ''
  const sql = neon(env.DATABASE_URL)

  try {
    if (method === 'POST') {
      trace(env, '[GIST] Creating Gist from Neon database')
      const result = await uploadNotesToGist(sql, gitToken)
      if (!result.ok) {
        await logToDatabase(env, result.status === 404 ? 'warn' : 'error', 'gist:post:failed', {
          error: result.error,
        })
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: result.status,
          headers: apiCors(request, env),
        })
      }

      await logToDatabase(env, 'info', 'gist:post:success', {
        gistId: result.gistId,
        count: result.totalNotes,
      })
      return new Response(
        JSON.stringify({
          success: true,
          message: '成功上传到Gist',
          fileName: 'notes.md',
          totalNotes: result.totalNotes,
          gistId: result.gistId,
        }),
        { status: 200, headers: apiCors(request, env) }
      )
    }

    if (method === 'GET') {
      trace(env, '[GIST] Downloading notes from Gist and importing to Neon')
      const result = await importNotesFromGist(sql, gitToken, {
        onTrace: (msg) => trace(env, '[GIST]', msg),
      })
      if (!result.ok) {
        await logToDatabase(env, 'error', 'gist:get:failed', { error: result.error })
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: result.status,
          headers: apiCors(request, env),
        })
      }

      await logToDatabase(env, 'info', 'gist:get:success', { importedCount: result.importedCount })
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
    console.error('Gist error:', error)
    logError('gist:unhandled', { message: error?.message }, env)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: apiCors(request, env),
    })
  }
}
