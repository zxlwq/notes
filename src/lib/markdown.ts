import remarkGfm from 'remark-gfm'
import { remarkHighlightMark } from 'remark-highlight-mark'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { marked, type TokenizerAndRendererExtension } from 'marked'
import { visit } from 'unist-util-visit'
import type { Options as RemarkRehypeOptions } from 'remark-rehype'
import type { State } from 'mdast-util-to-hast'
import type { Highlight, Link, Root, Text } from 'mdast'
import type { PluggableList } from 'unified'

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

export const markdownRemarkPlugins: PluggableList = [
  remarkGfm,
  remarkNoEmailAutolink,
  remarkHighlightMark,
]

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'u'],
}

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

const highlightExtension: TokenizerAndRendererExtension = {
  name: 'highlightMark',
  level: 'inline',
  start(src) {
    const idx = src.indexOf('==')
    return idx === -1 ? undefined : idx
  },
  tokenizer(src) {
    const match = /^==([\s\S]+?)==/.exec(src)
    if (!match) return undefined
    return {
      type: 'highlightMark',
      raw: match[0],
      text: match[1],
      tokens: this.lexer.inlineTokens(match[1]),
    }
  },
  renderer(token) {
    return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`
  },
}

marked.use({
  extensions: [highlightExtension],
  gfm: true,
  tokenizer: {
    // 保留 http(s)/www 自动链接，禁用 user@host / :pass@host 邮箱自动链接
    url(src) {
      const cap = this.rules.inline.url.exec(src)
      if (!cap) return undefined
      if (cap[2] === '@') return undefined

      let raw = cap[0]
      let prev: string
      do {
        prev = raw
        raw = this.rules.inline._backpedal.exec(raw)?.[0] ?? ''
      } while (prev !== raw)

      const text = raw
      const href = cap[1] === 'www.' ? `http://${text}` : text
      return {
        type: 'link',
        raw: text,
        text,
        href,
        tokens: [{ type: 'text', raw: text, text }],
      }
    },
  },
})

interface ContentBlock {
  start: number
  end: number
}

function findCodeBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const regex = /```[\w]*\n?[\s\S]*?\n?```/g
  let match
  while ((match = regex.exec(content)) !== null) {
    blocks.push({ start: match.index, end: match.index + match[0].length })
  }
  return blocks
}

function findTableBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const lines = content.split('\n')
  let offset = 0
  let tableStart: number | null = null

  const flushTable = (end: number) => {
    if (tableStart !== null) {
      blocks.push({ start: tableStart, end })
      tableStart = null
    }
  }

  for (const line of lines) {
    const lineEnd = offset + line.length
    const isTableRow = /^\s*\|.+\|\s*$/.test(line)

    if (isTableRow) {
      if (tableStart === null) tableStart = offset
    } else {
      flushTable(offset)
    }

    offset = lineEnd + 1
  }

  flushTable(content.length)
  return blocks
}

function mergeBlocks(...groups: ContentBlock[][]): ContentBlock[] {
  return groups
    .flat()
    .sort((a, b) => a.start - b.start)
    .reduce<ContentBlock[]>((merged, block) => {
      const last = merged[merged.length - 1]
      if (last && block.start <= last.end) {
        last.end = Math.max(last.end, block.end)
      } else {
        merged.push({ ...block })
      }
      return merged
    }, [])
}

function transformSegment(segment: string): string {
  return (
    segment
      .replace(/([^\n\r])\n([^\n\r])/g, '$1  \n$2')
      // 冒号后紧跟 token/密钥等时禁止在冒号处软换行（保留 :// 协议）
      .replace(/([：:])(?!\/\/)(?=[A-Za-z0-9+/_=-])/g, '$1\u2060')
      .replace(/\n{3,}/g, '\n\n')
  )
}

/** 代码块/表格区域（解析 TOC 时跳过） */
export function getProtectedBlockRanges(content: string): ContentBlock[] {
  return mergeBlocks(findCodeBlocks(content), findTableBlocks(content))
}

/** 预处理 Markdown：保护代码块和表格，避免换行规则破坏 GFM 表格语法 */
export function preprocessMarkdownContent(content: string): string {
  const protectedBlocks = mergeBlocks(findCodeBlocks(content), findTableBlocks(content))

  if (protectedBlocks.length === 0) {
    return transformSegment(content)
      .replace(/^\n+|\n+$/g, '')
      .trim()
  }

  let processed = ''
  let lastIndex = 0

  for (const block of protectedBlocks) {
    processed += transformSegment(content.substring(lastIndex, block.start))
    processed += content.substring(block.start, block.end)
    lastIndex = block.end
  }

  processed += transformSegment(content.substring(lastIndex))
  return processed.replace(/^\n+|\n+$/g, '').trim()
}

/** SimpleMDE 预览：与详情页共用预处理 + GFM + ==高亮== */
export function renderEditorPreviewHtml(content: string): string {
  const processed = preprocessMarkdownContent(content)
  return marked.parse(processed, { async: false }) as string
}
