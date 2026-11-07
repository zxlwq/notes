import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkParse from 'remark-parse'
import { remarkHighlightMark } from 'remark-highlight-mark'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { toString } from 'mdast-util-to-string'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Options as RemarkRehypeOptions } from 'remark-rehype'
import type { State } from 'mdast-util-to-hast'
import type { Heading, Highlight, Link, Root, Text } from 'mdast'
import type { PluggableList } from 'unified'
import { slugify } from '@/lib/utils'

export interface TocItem {
  level: number
  text: string
  id: string
}

/** 关闭 GFM 邮箱自动链接，避免连接串 user:pass@host 被识别为 mailto */
function remarkNoEmailAutolink() {
  return (tree: Root) => {
    visit(tree, 'link', (node: Link, index, parent) => {
      if (parent == null || typeof index !== 'number' || !node.url.startsWith('mailto:')) {
        return
      }
      const email = node.url.slice('mailto:'.length)
      const textChild = node.children[0] as Text | undefined
      const label =
        node.children.length === 1 && textChild?.type === 'text' ? textChild.value : null
      if (label == null || label !== email) return
      parent.children.splice(index, 1, { type: 'text', value: email })
    })
  }
}

/** 标题纯文本（去链接语法等），供 TOC 与 id 共用 */
export function normalizeHeadingText(raw: string): string {
  return raw
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_~=`]/g, '')
    .trim()
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

/**
 * 在 mdast 写入 heading 的 hProperties.id（与 TOC 同一套算法）。
 * 仅处理 Markdown 标题，避免 rehype-raw 的 HTML 标题打乱序号。
 */
function assignHeadingIds(tree: Root, toc?: TocItem[]) {
  const counts: Record<string, number> = {}
  visit(tree, 'heading', (node: Heading) => {
    const text = normalizeHeadingText(toString(node))
    if (!text) return
    const id = makeHeadingId(text, counts)
    node.data = node.data || {}
    node.data.hProperties = { ...(node.data.hProperties as object | undefined), id }
    toc?.push({ level: node.depth, text, id })
  })
}

function remarkHeadingIds() {
  return (tree: Root) => {
    assignHeadingIds(tree)
  }
}

/** 详情 / AI 共用 remark：GFM + 单换行硬断行 + ==高亮== + 标题 id + 禁用邮箱自动链接 */
export const markdownRemarkPlugins: PluggableList = [
  remarkGfm,
  remarkBreaks,
  remarkNoEmailAutolink,
  remarkHighlightMark,
  remarkHeadingIds,
]

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
    // 多空行占位段落
    p: [...(defaultSchema.attributes?.p ?? []), ['className', 'md-blank'], 'ariaHidden'],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'u'],
}

/** 详情页 rehype：raw → sanitize → highlight（标题 id 已在 remark 写入） */
export const markdownRehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, sanitizeSchema],
  rehypeHighlight,
]

export const markdownRemarkRehypeOptions: RemarkRehypeOptions = {
  handlers: {
    highlight(state: State, node: Highlight) {
      return {
        type: 'element',
        tagName: 'mark',
        properties: {},
        children: state.all(node),
      }
    },
  },
}

interface ContentBlock {
  start: number
  end: number
}

/** 围栏代码块（``` / ~~~），保留多空行时不得改写内部 */
function findFenceBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const regex = /^ {0,3}([`~]{3,})[^\n]*\n[\s\S]*?\n {0,3}\1[^\S\n]*$/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    blocks.push({ start: match.index, end: match.index + match[0].length })
  }
  return blocks
}

function isInsideBlock(index: number, blocks: ContentBlock[]): boolean {
  return blocks.some((b) => index >= b.start && index < b.end)
}

/** 多空行占位：每个「超出标准段间距」的空行对应一个占位段落 */
const BLANK_GAP_HTML = '<p class="md-blank" aria-hidden="true"><br></p>'

/**
 * 保留编辑器中的多余空行（标准 MD 会折叠）。
 * 仅改写围栏外文本：连续 ≥3 个换行 → 段间距 + (n-2) 个占位块。
 */
export function preserveExtraBlankLines(content: string): string {
  if (!content) return content
  const fences = findFenceBlocks(content)
  const re = /\n(?:[ \t]*\n){2,}/g
  let result = ''
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(content)) !== null) {
    if (isInsideBlock(match.index, fences)) continue
    result += content.slice(last, match.index)
    const newlines = (match[0].match(/\n/g) || []).length
    const extra = Math.max(0, newlines - 2)
    result += '\n\n' + (extra > 0 ? `${BLANK_GAP_HTML}\n\n`.repeat(extra) : '')
    last = match.index + match[0].length
  }

  result += content.slice(last)
  return result
}

/** 从同一套 remark 管道提取 TOC（与详情页标题 id 一致） */
export function parseTocItems(content: string): TocItem[] {
  if (!content.trim()) return []
  const toc: TocItem[] = []
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkNoEmailAutolink)
    .use(remarkHighlightMark)

  const tree = processor.parse(content) as Root
  processor.runSync(tree)
  assignHeadingIds(tree, toc)
  return toc
}
