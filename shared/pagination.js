const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

export function parsePageLimit(query = {}) {
  const page = Math.max(1, Number.parseInt(String(query.page ?? ''), 10) || 1)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(String(query.limit ?? ''), 10) || DEFAULT_LIMIT)
  )
  return { page, limit, offset: (page - 1) * limit }
}

export function buildNotesListResponse(items, total, page, limit) {
  return {
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  }
}
