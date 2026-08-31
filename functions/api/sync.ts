import { checkAuth } from '../_utils/auth'
import { isPgSyncEnabled, syncD1ToPostgres } from '../_utils/pgSync'
import type { PagesFunction } from '../types'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: apiPreflight(request, env, 'GET, POST, OPTIONS'),
    })
  }

  if (!env.NOTESD) {
    return Response.json(
      { error: 'Database not bound', message: 'D1 数据库尚未绑定' },
      { status: 500, headers: apiCors(request, env) }
    )
  }

  const auth = await checkAuth(request, env)
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  if (request.method === 'GET') {
    return Response.json(
      {
        configured: isPgSyncEnabled(env),
        description: isPgSyncEnabled(env)
          ? 'D1 变更将异步同步至 DATABASE_URL 指向的 PostgreSQL'
          : '在 Pages 环境变量中设置 DATABASE_URL 以启用跨平台数据同步',
      },
      { headers: apiCors(request, env) }
    )
  }

  if (request.method === 'POST') {
    if (!isPgSyncEnabled(env)) {
      return Response.json(
        { error: 'DATABASE_URL not configured' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const result = await syncD1ToPostgres(env)
    return Response.json(result, { headers: apiCors(request, env) })
  }

  return Response.json(
    { error: 'Method not allowed' },
    { status: 405, headers: apiCors(request, env) }
  )
}
