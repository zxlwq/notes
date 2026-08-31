import { logToD1 } from '../../_utils/log'
import { checkAuth } from '../../_utils/auth'
import { triggerPgSync } from '../../_utils/pgSync'
import type { PagesFunction } from '../../types'
import { ensureNotesTable, getNoteById, updateNote, deleteNote } from '../../../shared/d1-notes.js'
import { apiCors, apiPreflight } from '../../_utils/cors'

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context
  const method = request.method

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: apiPreflight(request, env),
    })
  }

  switch (method) {
    case 'GET':
      return handleGet(context)
    case 'PUT':
      return handlePut(context)
    case 'DELETE':
      return handleDelete(context)
    default:
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: apiCors(request, env) }
      )
  }
}

const extractNoteId = (request: Request): string | null => {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean)
  return parts.length >= 3 ? parts[2] : null
}

const handleGet: PagesFunction = async ({ request, env }) => {
  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  try {
    await ensureNotesTable(env.NOTESD!)
    const noteId = extractNoteId(request)
    if (!noteId) {
      return Response.json(
        { error: 'Note ID required' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const note = await getNoteById(env.NOTESD!, noteId)
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: errorMessage }, { status: 500, headers: apiCors(request, env) })
  }
}

const handlePut: PagesFunction = async (context) => {
  const { request, env } = context
  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  try {
    await ensureNotesTable(env.NOTESD!)
    const noteId = extractNoteId(request)
    if (!noteId) {
      return Response.json(
        { error: 'Note ID required' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const { title, content, tags } = (await request.json()) || {}
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

    const ok = await updateNote(env.NOTESD!, noteId, {
      title,
      content,
      tags: (tags as string[]) || [],
    })
    if (!ok) {
      return Response.json(
        { error: 'Note not found' },
        { status: 404, headers: apiCors(request, env) }
      )
    }

    triggerPgSync(context)
    return Response.json({ success: true }, { headers: apiCors(request, env) })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return Response.json({ error: errorMessage }, { status: 500, headers: apiCors(request, env) })
  }
}

const handleDelete: PagesFunction = async (context) => {
  const { request, env } = context
  if (!(await checkAuth(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: apiCors(request, env) })
  }

  try {
    await ensureNotesTable(env.NOTESD!)
    const noteId = extractNoteId(request)
    if (!noteId) {
      return Response.json(
        { error: 'Note ID required' },
        { status: 400, headers: apiCors(request, env) }
      )
    }

    const note = await getNoteById(env.NOTESD!, noteId)
    if (!note) {
      await logToD1(env, 'warn', 'notes.delete.not_found', { id: noteId })
      return Response.json(
        { error: 'Note not found' },
        { status: 404, headers: apiCors(request, env) }
      )
    }

    await deleteNote(env.NOTESD!, noteId)
    await logToD1(env, 'info', 'notes.delete', { id: noteId, title: note.title || '无标题' })
    triggerPgSync(context)
    return Response.json({ success: true }, { headers: apiCors(request, env) })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    await logToD1(env, 'error', 'notes.delete.exception', { message: errorMessage })
    return Response.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500, headers: apiCors(request, env) }
    )
  }
}
