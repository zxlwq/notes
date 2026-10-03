import type { Note, SearchHistory, SearchOptions } from '@/types'
import { normalizeHeadingText } from '@/lib/mdView'
import {
  buildContentSnippet,
  clearSearchIndex,
  ensureSearchIndexed,
  getSearchIndexWarmProgress,
  hydrateNoteFromIndex,
  loadNoteFromSearchIndex,
  loadNoteFromSearchIndexIfFresh,
  readAllSearchIndexEntries,
  removeSearchIndexEntry,
  upsertSearchIndexEntries,
  upsertSearchIndexEntry,
  warmSearchIndex,
  type IndexWarmProgress,
} from '@/lib/searchIdx'

export {
  clearSearchIndex,
  getSearchIndexWarmProgress,
  loadNoteFromSearchIndex,
  loadNoteFromSearchIndexIfFresh,
  removeSearchIndexEntry,
  upsertSearchIndexEntry,
  warmSearchIndex,
  type IndexWarmProgress,
}

export interface SearchSuggestion {
  text: string
  note: Note
  type: 'title' | 'tag' | 'content'
  snippet?: string
  position?: {
    startIndex: number
    endIndex: number
    searchTerm: string
  }
}

export type ResolvedSearchOptions = Required<SearchOptions>

export interface SearchRuntimeOptions extends SearchOptions {
  signal?: AbortSignal
  /** 单次搜索最多补拉正文数（索引未命中时） */
  maxContentFetches?: number
  /** 搜索结果分页 */
  page?: number
  limit?: number
}

export interface SearchPageResult {
  items: Note[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

const SUGGESTION_CONTENT_LIMIT = 25
const DEFAULT_PAGE_LIMIT = 200
const HISTORY_KEY = 'search-history'
const FILTERS_KEY = 'search-filters'
const MAX_HISTORY = 10

export const DEFAULT_SEARCH_OPTIONS: ResolvedSearchOptions = {
  useRegex: false,
  caseSensitive: false,
  searchInTitle: true,
  searchInContent: true,
  searchInTags: true,
}

export function resolveSearchOptions(options: SearchOptions = {}): ResolvedSearchOptions {
  return { ...DEFAULT_SEARCH_OPTIONS, ...options }
}

export function readSearchFilters(): ResolvedSearchOptions {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return DEFAULT_SEARCH_OPTIONS
    return resolveSearchOptions(JSON.parse(raw) as SearchOptions)
  } catch {
    return DEFAULT_SEARCH_OPTIONS
  }
}

export function saveSearchFilters(options: SearchOptions): void {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(resolveSearchOptions(options)))
}

export function readSearchHistory(): SearchHistory[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SearchHistory[]
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item?.query === 'string') : []
  } catch {
    return []
  }
}

export function addSearchHistory(query: string): void {
  const trimmed = query.trim()
  if (!trimmed) return
  const prev = readSearchHistory().filter((item) => item.query !== trimmed)
  const next: SearchHistory[] = [{ query: trimmed, timestamp: Date.now() }, ...prev].slice(
    0,
    MAX_HISTORY
  )
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export function clearSearchHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}

/** 列表摘要写入索引（不含正文时仅更新元数据） */
export function primeSearchCache(summaries: Note[]): void {
  void upsertSearchIndexEntries(
    summaries.filter((note) => note.content != null && note.content !== undefined)
  )
}

export async function clearSearchCache(): Promise<void> {
  await clearSearchIndex()
}

function createMatcher(query: string, opts: ResolvedSearchOptions) {
  const trimmed = query.trim()
  if (!trimmed) return () => false

  if (opts.useRegex) {
    try {
      const re = new RegExp(trimmed, opts.caseSensitive ? '' : 'i')
      return (text: string) => re.test(text)
    } catch {
      // fall through to literal match
    }
  }

  const needle = opts.caseSensitive ? trimmed : trimmed.toLowerCase()
  return (text: string) => {
    const haystack = opts.caseSensitive ? text : text.toLowerCase()
    return haystack.includes(needle)
  }
}

function titleOrTagMatches(
  note: Note,
  matcher: ReturnType<typeof createMatcher>,
  opts: ResolvedSearchOptions
): boolean {
  if (opts.searchInTitle && note.title && matcher(note.title)) return true
  if (opts.searchInTags && note.tags?.some((tag) => matcher(tag))) return true
  return false
}

function noteMatches(
  note: Note,
  matcher: ReturnType<typeof createMatcher>,
  opts: ResolvedSearchOptions
): boolean {
  if (titleOrTagMatches(note, matcher, opts)) return true
  if (opts.searchInContent && note.content && matcher(note.content)) return true
  return false
}

async function loadIndexedNotesMap(
  summaries: Note[],
  signal?: AbortSignal,
  maxFetches = Number.POSITIVE_INFINITY
): Promise<Map<string, Note>> {
  const map = new Map<string, Note>()
  for (const summary of summaries) {
    map.set(summary.id, summary)
  }

  const entries = await readAllSearchIndexEntries()
  for (const entry of entries) {
    const summary = map.get(entry.id)
    if (!summary) continue
    map.set(entry.id, {
      ...summary,
      title: entry.title || summary.title,
      tags: entry.tags.length ? entry.tags : summary.tags,
      content: entry.content,
    })
  }

  if (signal?.aborted) return map

  const needHydrate = summaries.filter((summary) => {
    const note = map.get(summary.id)
    if (!optsNeedContent(summary)) return false
    return !note?.content && (summary.contentLength ?? 0) > 0
  })

  await ensureSearchIndexed(needHydrate, signal, maxFetches)

  for (const summary of needHydrate) {
    if (signal?.aborted) break
    const note = map.get(summary.id)
    if (note?.content) continue
    const hydrated = await hydrateNoteFromIndex(summary)
    map.set(summary.id, hydrated)
  }

  return map
}

function optsNeedContent(summary: Note): boolean {
  return (summary.contentLength ?? 0) > 0 || Boolean(summary.content)
}

export async function searchNotes(
  query: string,
  summaries: Note[],
  options: SearchRuntimeOptions = {}
): Promise<Note[]> {
  const pageResult = await searchNotesPaged(query, summaries, options)
  return pageResult.items
}

export async function searchNotesPaged(
  query: string,
  summaries: Note[],
  options: SearchRuntimeOptions = {}
): Promise<SearchPageResult> {
  const {
    signal,
    maxContentFetches = Number.POSITIVE_INFINITY,
    page = 1,
    limit = DEFAULT_PAGE_LIMIT,
    ...filterOpts
  } = options
  const opts = resolveSearchOptions(filterOpts)
  const trimmed = query.trim()
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, limit)

  if (!trimmed) {
    const start = (safePage - 1) * safeLimit
    const items = summaries.slice(start, start + safeLimit)
    return {
      items,
      total: summaries.length,
      page: safePage,
      limit: safeLimit,
      hasMore: start + safeLimit < summaries.length,
    }
  }
  if (signal?.aborted) {
    return { items: [], total: 0, page: safePage, limit: safeLimit, hasMore: false }
  }
  if (!opts.searchInTitle && !opts.searchInContent && !opts.searchInTags) {
    return { items: [], total: 0, page: safePage, limit: safeLimit, hasMore: false }
  }

  const matcher = createMatcher(trimmed, opts)
  const indexed = await loadIndexedNotesMap(summaries, signal, maxContentFetches)

  const matched: Note[] = []
  for (const summary of summaries) {
    if (signal?.aborted) break
    const note = indexed.get(summary.id) ?? summary
    if (noteMatches(note, matcher, opts)) {
      matched.push(note)
    }
  }

  const start = (safePage - 1) * safeLimit
  const items = matched.slice(start, start + safeLimit)
  return {
    items,
    total: matched.length,
    page: safePage,
    limit: safeLimit,
    hasMore: start + safeLimit < matched.length,
  }
}

function makeMatchPosition(content: string, startIndex: number, endIndex: number) {
  return {
    startIndex,
    endIndex,
    searchTerm: content.slice(startIndex, endIndex),
  }
}

function findTextMatchPosition(
  content: string,
  query: string,
  caseSensitive: boolean
): SearchSuggestion['position'] | undefined {
  if (!content || !query) return undefined
  const haystack = caseSensitive ? content : content.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const hit = haystack.indexOf(needle)
  if (hit < 0) return undefined
  const endIndex = hit + query.length
  return makeMatchPosition(content, hit, endIndex)
}

function findHeadingMatchPosition(
  content: string,
  query: string,
  caseSensitive: boolean
): SearchSuggestion['position'] | undefined {
  if (!content || !query) return undefined
  const needle = caseSensitive ? query : query.toLowerCase()
  const regex = /^(#{1,6})\s+(.+)$/gm
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const headingText = match[2]
    const haystack = caseSensitive ? headingText : headingText.toLowerCase()
    const local = haystack.indexOf(needle)
    if (local < 0) continue
    const prefixLen = match[0].length - headingText.length
    const startIndex = match.index + prefixLen + local
    const endIndex = startIndex + query.length
    return makeMatchPosition(content, startIndex, endIndex)
  }

  return undefined
}

function resolveHighlightPosition(
  note: Note,
  query: string,
  caseSensitive: boolean,
  preferHeading = false
): SearchSuggestion['position'] | undefined {
  const content = note.content ?? ''
  if (preferHeading) {
    const heading = findHeadingMatchPosition(content, query, caseSensitive)
    if (heading) return heading
  }
  return (
    findTextMatchPosition(content, query, caseSensitive) ??
    findTextMatchPosition(note.title ?? '', query, caseSensitive)
  )
}

function buildContentSuggestions(
  note: Note,
  matcher: ReturnType<typeof createMatcher>,
  query: string,
  caseSensitive: boolean
): SearchSuggestion[] {
  const suggestions: SearchSuggestion[] = []
  const content = note.content
  if (!content) return suggestions

  const snippetHit = buildContentSnippet(content, query, caseSensitive)
  if (snippetHit) {
    suggestions.push({
      text: snippetHit.snippet,
      snippet: snippetHit.snippet,
      note,
      type: 'content',
      position: makeMatchPosition(content, snippetHit.startIndex, snippetHit.endIndex),
    })
  }

  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  let headingMatch: RegExpExecArray | null
  while ((headingMatch = headingRegex.exec(content)) !== null) {
    const headingText = headingMatch[2]
    const plain = normalizeHeadingText(headingText)
    if (!plain || (!matcher(headingText) && !matcher(plain))) continue
    if (suggestions.some((s) => s.text === plain)) continue

    const haystack = caseSensitive ? headingText : headingText.toLowerCase()
    const needle = caseSensitive ? query : query.toLowerCase()
    const local = haystack.indexOf(needle)
    if (local < 0) continue

    const prefixLen = headingMatch[0].length - headingText.length
    const startIndex = headingMatch.index + prefixLen + local
    const endIndex = startIndex + query.length
    suggestions.push({
      text: plain,
      snippet: plain,
      note,
      type: 'content',
      position: makeMatchPosition(content, startIndex, endIndex),
    })
  }

  const sentences = content
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((sentence) => sentence.length > 0 && sentence.length <= 100 && matcher(sentence))

  for (const sentence of sentences.slice(0, 3)) {
    if (suggestions.some((s) => s.text.includes(sentence))) continue
    const local = caseSensitive
      ? sentence.indexOf(query)
      : sentence.toLowerCase().indexOf(query.toLowerCase())
    if (local < 0) continue
    const matchStart = content.indexOf(sentence) + local
    const matchEnd = matchStart + query.length
    suggestions.push({
      text: sentence,
      snippet: sentence,
      note,
      type: 'content',
      position: makeMatchPosition(content, matchStart, matchEnd),
    })
  }

  return suggestions
}

export async function getSearchSuggestions(
  query: string,
  summaries: Note[],
  options: SearchRuntimeOptions = {}
): Promise<SearchSuggestion[]> {
  const { signal, maxContentFetches = SUGGESTION_CONTENT_LIMIT, ...filterOpts } = options
  const opts = resolveSearchOptions(filterOpts)
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 2) return []
  if (signal?.aborted) return []
  if (!opts.searchInTitle && !opts.searchInContent && !opts.searchInTags) return []

  const matcher = createMatcher(trimmed, opts)
  const indexed = await loadIndexedNotesMap(summaries, signal, maxContentFetches)

  const suggestions: SearchSuggestion[] = []
  const contentCandidateIds: string[] = []

  for (const summary of summaries) {
    const note = indexed.get(summary.id) ?? summary

    if (opts.searchInTitle && note.title && matcher(note.title)) {
      suggestions.push({
        text: note.title,
        note,
        type: 'title',
        position: resolveHighlightPosition(note, trimmed, opts.caseSensitive, true),
      })
    }

    if (opts.searchInTags) {
      note.tags?.forEach((tag) => {
        if (matcher(tag)) {
          suggestions.push({
            text: tag,
            note,
            type: 'tag',
            position: resolveHighlightPosition(note, trimmed, opts.caseSensitive),
          })
        }
      })
    }

    if (opts.searchInContent && note.content && matcher(note.content)) {
      contentCandidateIds.push(summary.id)
    }
  }

  if (opts.searchInContent) {
    for (const id of contentCandidateIds.slice(0, SUGGESTION_CONTENT_LIMIT)) {
      if (signal?.aborted) break
      const note = indexed.get(id)
      if (note?.content) {
        suggestions.push(...buildContentSuggestions(note, matcher, trimmed, opts.caseSensitive))
      }
    }
  }

  const seen = new Map<string, SearchSuggestion>()
  for (const item of suggestions) {
    const key = `${item.note.id}\0${item.type}\0${item.text}`
    const prev = seen.get(key)
    if (!prev || (item.position && !prev.position)) {
      seen.set(key, item)
    }
  }
  const unique = Array.from(seen.values())

  const sorted = unique.sort((a, b) => {
    const aLower = a.text.toLowerCase()
    const bLower = b.text.toLowerCase()
    const queryLower = trimmed.toLowerCase()
    const aStartsWith = aLower.startsWith(queryLower)
    const bStartsWith = bLower.startsWith(queryLower)
    if (aStartsWith && !bStartsWith) return -1
    if (!aStartsWith && bStartsWith) return 1
    const typeOrder = { title: 0, tag: 1, content: 2 }
    const typeDiff = typeOrder[a.type] - typeOrder[b.type]
    if (typeDiff !== 0) return typeDiff
    if (a.position && !b.position) return -1
    if (!a.position && b.position) return 1
    return a.text.length - b.text.length
  })

  return sorted.slice(0, 10)
}
