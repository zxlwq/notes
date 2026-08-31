import { slugify } from '@/lib/utils'

import { preprocessMarkdownContent, getProtectedBlockRanges } from './markdown'

export interface TocItem {
  level: number
  text: string
  id: string
}

export interface HighlightRange {
  startIndex: number
  endIndex: number
  searchTerm?: string
}

/** 与 parseTocItems 一致的标题纯文本规范化 */
export function normalizeHeadingText(raw: string): string {
  return raw
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_~=`]/g, '')
    .trim()
}

function isInsideProtectedBlock(index: number, blocks: { start: number; end: number }[]): boolean {
  return blocks.some((b) => index >= b.start && index < b.end)
}

export function parseTocItems(content: string): TocItem[] {
  const processed = preprocessMarkdownContent(content)
  const protectedBlocks = getProtectedBlockRanges(processed)
  const counts: Record<string, number> = {}
  const items: TocItem[] = []
  const regex = /^(#{1,6})\s+(.+)$/gm
  let match: RegExpExecArray | null

  while ((match = regex.exec(processed)) !== null) {
    if (isInsideProtectedBlock(match.index, protectedBlocks)) continue

    const level = match[1].length
    const text = normalizeHeadingText(match[2])
    if (!text) continue

    const id = makeHeadingId(text, counts)
    items.push({ level, text, id })
  }

  return items
}

export function makeHeadingId(text: string, counts: Record<string, number>): string {
  let id = slugify(text)
  if (counts[id] !== undefined) {
    counts[id] += 1
    id = `${id}-${counts[id]}`
  } else {
    counts[id] = 0
  }
  return id
}

export function isExternalUrl(href?: string): boolean {
  if (!href) return false
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:')) return false
  return /^https?:\/\//i.test(href)
}

export function langFromClass(className?: string): string {
  const match = className?.match(/language-([\w-]+)/)
  return match?.[1] ?? ''
}

const SKIP_HIGHLIGHT_SELECTOR = 'script, style, .md-toc, .md-copy-btn, .md-pre-lang'

function shouldSkipHighlightText(node: Text): boolean {
  const parent = node.parentElement
  if (!parent) return true
  return Boolean(parent.closest(SKIP_HIGHLIGHT_SELECTOR))
}

function buildDomTextStream(root: HTMLElement): string {
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let textNode: Text | null

  while ((textNode = walker.nextNode() as Text | null)) {
    if (shouldSkipHighlightText(textNode)) continue
    text += textNode.data
  }

  return text
}

function countOccurrencesBefore(
  text: string,
  beforeIndex: number,
  term: string,
  caseSensitive: boolean
): number {
  if (!term) return 0
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? term : term.toLowerCase()
  let count = 0
  let pos = 0

  while (pos < beforeIndex) {
    const found = haystack.indexOf(needle, pos)
    if (found < 0 || found >= beforeIndex) break
    count += 1
    pos = found + needle.length
  }

  return count
}

function findNthOccurrence(
  text: string,
  term: string,
  occurrence: number,
  caseSensitive: boolean
): number {
  if (!term) return -1
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? term : term.toLowerCase()
  let count = 0
  let pos = 0

  while (true) {
    const found = haystack.indexOf(needle, pos)
    if (found < 0) return -1
    if (count === occurrence) return found
    count += 1
    pos = found + needle.length
  }
}

function resolveHighlightIndices(
  range: HighlightRange,
  domText: string,
  sourceContent?: string
): { start: number; end: number } {
  const { startIndex, endIndex, searchTerm } = range
  const term = searchTerm || sourceContent?.slice(startIndex, endIndex) || ''
  if (!term) return { start: startIndex, end: endIndex }

  const caseSensitive = sourceContent ? sourceContent.slice(startIndex, endIndex) === term : false

  if (sourceContent) {
    const occurrence = countOccurrencesBefore(sourceContent, startIndex, term, caseSensitive)
    const domStart = findNthOccurrence(domText, term, occurrence, caseSensitive)
    if (domStart >= 0) {
      return { start: domStart, end: domStart + term.length }
    }
  }

  const fallbackStart = findNthOccurrence(domText, term, 0, caseSensitive)
  if (fallbackStart >= 0) {
    return { start: fallbackStart, end: fallbackStart + term.length }
  }

  return { start: startIndex, end: endIndex }
}

function flashHeading(el: HTMLElement) {
  el.classList.remove('md-heading-flash')
  void el.offsetWidth
  el.classList.add('md-heading-flash')
  const onEnd = () => {
    el.classList.remove('md-heading-flash')
    el.removeEventListener('animationend', onEnd)
  }
  el.addEventListener('animationend', onEnd)
}

function findHeadingByLabel(root: HTMLElement, label: string): HTMLElement | null {
  const target = normalizeHeadingText(label).toLowerCase()
  if (!target) return null

  for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const text = normalizeHeadingText(heading.textContent || '').toLowerCase()
    if (text === target || text.includes(target) || target.includes(text)) {
      return heading as HTMLElement
    }
  }

  const id = slugify(normalizeHeadingText(label))
  const byId = root.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null
  return byId
}

function highlightHeadingTarget(root: HTMLElement, label: string): HTMLElement | null {
  const heading = findHeadingByLabel(root, label)
  if (!heading) return null
  heading.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashHeading(heading)
  return heading
}

function highlightNoteTitle(): HTMLElement | null {
  const h1 = document.querySelector('[data-note-title]') as HTMLElement | null
  if (!h1) return null
  h1.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashHeading(h1)
  return h1
}

function collectTextSegments(root: HTMLElement, start: number, end: number) {
  const segments: { node: Text; start: number; end: number }[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let offset = 0
  let textNode: Text | null

  while ((textNode = walker.nextNode() as Text | null)) {
    if (shouldSkipHighlightText(textNode)) continue
    const len = textNode.data.length
    const nodeStart = offset
    const nodeEnd = offset + len

    if (end <= nodeStart) break
    if (start < nodeEnd && end > nodeStart) {
      segments.push({
        node: textNode,
        start: Math.max(0, start - nodeStart),
        end: Math.min(len, end - nodeStart),
      })
    }
    offset = nodeEnd
  }

  return segments
}

function wrapTextRange(node: Text, localStart: number, localEnd: number): HTMLElement {
  const text = node.data
  const before = text.slice(0, localStart)
  const mid = text.slice(localStart, localEnd)
  const after = text.slice(localEnd)
  const mark = document.createElement('mark')
  mark.className = 'md-search-hit'
  mark.textContent = mid
  const parent = node.parentNode
  if (!parent) return mark

  if (after) parent.insertBefore(document.createTextNode(after), node.nextSibling)
  parent.insertBefore(mark, node.nextSibling)
  if (before) {
    node.data = before
  } else {
    parent.removeChild(node)
  }
  return mark
}

/** 在已渲染的正文 DOM 中高亮字符区间并滚动到可见位置 */
export function highlightRangeInContent(
  root: HTMLElement,
  range: HighlightRange,
  sourceContent?: string
): HTMLElement | null {
  const term = range.searchTerm || sourceContent?.slice(range.startIndex, range.endIndex) || ''
  const domText = buildDomTextStream(root)

  if (domText) {
    const { start, end } = resolveHighlightIndices(range, domText, sourceContent)
    if (start < end) {
      const segments = collectTextSegments(root, start, end)
      if (segments.length > 0) {
        let firstMark: HTMLElement | null = null
        for (let i = segments.length - 1; i >= 0; i--) {
          const seg = segments[i]
          if (!seg.node.parentNode) continue
          const mark = wrapTextRange(seg.node, seg.start, seg.end)
          if (!firstMark) firstMark = mark
        }
        firstMark?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return firstMark
      }
    }
  }

  if (term) {
    const heading = highlightHeadingTarget(root, term)
    if (heading) return heading
    return highlightNoteTitle()
  }

  return null
}

export function extractCodeFromSource(source: string, preIndex: number): string {
  const codeBlockRegex = /```[\w-]*\n?([\s\S]*?)\n?```/g
  const blocks: string[] = []
  let match: RegExpExecArray | null
  while ((match = codeBlockRegex.exec(source)) !== null) {
    blocks.push(match[1] ?? '')
  }
  if (preIndex >= 0 && preIndex < blocks.length) {
    return blocks[preIndex].replace(/\n+$/, '')
  }
  return blocks[0]?.replace(/\n+$/, '') ?? ''
}
