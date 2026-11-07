import { logToD1 } from '../_utils/log'
import { checkAuth } from '../_utils/auth'
import { triggerPgSync } from '../_utils/pgSync'
import type { PagesFunction } from '../types'
import {
  ensureNotesTable,
  listNoteSummaries,
  listNoteSummariesPage,
  getNoteById,
  createNote,
  upsertDefaultNote,
  updateNote,
} from '../../shared/d1-notes.js'
import { apiCors, apiPreflight } from '../_utils/cors'

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context
  const method = request.method

  if (!env.NOTESD) {
    return Response.json(
      { error: 'Database not bound', message: '⚠️ D1 数据库尚未绑定' },
      { status: 500, headers: apiCors(request, env) }
    )
  }

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env),
    })
  }

  switch (method) {
    case 'GET':
      return handleGet(context)
    case 'POST':
      return handlePost(context)
    case 'PUT':
      return handlePut(context)
    default:
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: apiCors(request, env) }
      )
  }
}

const handleGet: PagesFunction = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  try {
    await ensureNotesTable(env.NOTESD!)
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/').filter(Boolean)

    if (pathParts.length >= 3 && pathParts[2]) {
      const note = await getNoteById(env.NOTESD!, pathParts[2])
      if (!note) {
        return Response.json(
          { error: 'Note not found' },
          { status: 404, headers: apiCors(request, env) }
        )
      }
      return Response.json(
        { ...note, title: note.title || '无标题' },
        { headers: apiCors(request, env) }
      )
    }

    const paginated = url.searchParams.has('page') || url.searchParams.has('limit')
    if (paginated) {
      const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '30', 10) || 30)
      )
      const result = await listNoteSummariesPage(env.NOTESD!, page, limit)
      const items = result.items.map((n) => ({ ...n, title: n.title || '无标题' }))
      await logToD1(env, 'info', 'notes.list.page', { page, limit, count: items.length })
      return Response.json({ ...result, items }, { headers: apiCors(request, env) })
    }

    const notes = (await listNoteSummaries(env.NOTESD!)).map((n) => ({
      ...n,
      title: n.title || '无标题',
    }))
    await logToD1(env, 'info', 'notes.list', { count: notes.length })
    return Response.json(notes, { headers: apiCors(request, env) })
  } catch (error) {
    console.error('Database error:', error)
    await logToD1(env, 'error', 'notes.get.exception', {
      message: error instanceof Error ? error.message : String(error),
    })
    return Response.json(
      { error: 'Internal server error' },
      { status: 500, headers: apiCors(request, env) }
    )
  }
}

const handlePost: PagesFunction = async (context) => {
  const { request, env } = context
  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  try {
    await ensureNotesTable(env.NOTESD!)
    const body = await request.json()

    if (body.content && !body.title) {
      await upsertDefaultNote(env.NOTESD!, body.content)
      return Response.json({ success: true }, { headers: apiCors(request, env) })
    }

    const { id, title, content, tags, createdAt } = body
    if (typeof title !== 'string' || typeof content !== 'string') {
      return Response.json(
        { error: 'Invalid title or content' },
        { status: 400, headers: apiCors(request, env) }
      )
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      return Response.json(
        { error: 'Tags must be an array' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const noteId = await createNote(env.NOTESD!, {
      id: typeof id === 'string' ? id : undefined,
      title,
      content,
      tags: tags || [],
      createdAt: typeof createdAt === 'string' ? createdAt : undefined,
    })
    await logToD1(env, 'info', 'notes.create', { id: noteId, title })
    triggerPgSync(context)
    return Response.json({ success: true, id: noteId }, { headers: apiCors(request, env) })
  } catch (error) {
    console.error('Database error:', error)
    await logToD1(env, 'error', 'notes.create.exception', {
      message: error instanceof Error ? error.message : String(error),
    })
    return Response.json(
      { error: 'Internal server error' },
      { status: 500, headers: apiCors(request, env) }
    )
  }
}

const handlePut: PagesFunction = async (context) => {
  const { request, env } = context
  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  try {
    await ensureNotesTable(env.NOTESD!)
    const url = new URL(request.url)
    const noteId = url.pathname.split('/').filter(Boolean)[2]
    if (!noteId) {
      return Response.json(
        { error: 'Note ID required' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const { title, content, tags } = await request.json()
    if (typeof title !== 'string' || typeof content !== 'string') {
      return Response.json(
        { error: 'Invalid title or content' },
        { status: 400, headers: apiCors(request, env) }
      )
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      return Response.json(
        { error: 'Tags must be an array' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const ok = await updateNote(env.NOTESD!, noteId, { title, content, tags: tags || [] })
    if (!ok) {
      return Response.json(
        { error: 'Note not found' },
        { status: 404, headers: apiCors(request, env) }
      )
    }

    await logToD1(env, 'info', 'notes.update', { id: noteId })
    triggerPgSync(context)
    return Response.json({ success: true }, { headers: apiCors(request, env) })
  } catch (error) {
    console.error('Database error:', error)
    await logToD1(env, 'error', 'notes.update.exception', {
      message: error instanceof Error ? error.message : String(error),
    })
    return Response.json(
      { error: 'Internal server error' },
      { status: 500, headers: apiCors(request, env) }
    )
  }
}
