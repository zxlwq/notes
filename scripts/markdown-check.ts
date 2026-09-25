/**
 * Markdown 管道回归检测（不依赖测试框架）。
 * 用法: npm run test:markdown
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root as MdastRoot, Heading, Link } from 'mdast'
import { toString } from 'mdast-util-to-string'
import {
  parseTocItems,
  makeHeadingId,
  normalizeHeadingText,
  markdownRemarkPlugins,
  preserveExtraBlankLines,
} from '../src/lib/markdown.ts'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

function applyRemarkPlugins() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = unified().use(remarkParse)
  for (const plugin of markdownRemarkPlugins) {
    if (Array.isArray(plugin)) {
      processor = processor.use(plugin[0], plugin[1])
    } else {
      processor = processor.use(plugin)
    }
  }
  return processor
}

function renderHtml(md: string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkBreaks)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(md)
  )
}

function renderAppHtml(md: string): string {
  return String(applyRemarkPlugins().use(remarkRehype).use(rehypeStringify).processSync(md))
}

function collectHeadingIds(md: string): string[] {
  const counts: Record<string, number> = {}
  const ids: string[] = []
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks).parse(md) as MdastRoot
  visit(tree, 'heading', (node: Heading) => {
    const text = normalizeHeadingText(toString(node))
    if (!text) return
    ids.push(makeHeadingId(text, counts))
  })
  return ids
}

let passed = 0
function check(name: string, fn: () => void) {
  try {
    fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`  FAIL ${name}`)
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}

console.log('markdown-check')

check('GFM table survives single newlines (no broken rows)', () => {
  const md = `| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |`
  const html = renderHtml(md)
  assert(html.includes('<table>'), 'expected <table>')
  assert((html.match(/<tr>/g) || []).length >= 3, 'expected >= 3 table rows')
  assert(!html.includes('<br>'), 'table cells must not get hard-break <br>')
})

check('remark-breaks turns paragraph soft breaks into <br>', () => {
  const html = renderHtml('line one\nline two')
  assert(html.includes('<br>'), 'expected <br> for single newline in paragraph')
})

check('fenced code keeps internal newlines (no <br> inside code)', () => {
  const md = '```js\nconst a = 1\nconst b = 2\n```'
  const html = renderHtml(md)
  assert(html.includes('<pre>') && html.includes('<code'), 'expected fenced code block')
  assert(!html.includes('<br>'), 'code fence must not contain <br>')
})

check('credential-like user:pass@host is not mailto', () => {
  const html = renderAppHtml('connect user:pass@host now')
  assert(!html.includes('mailto:'), 'credential host must not be mailto')
})

check('bare email autolink is undone by remarkNoEmailAutolink', () => {
  const tree = applyRemarkPlugins().parse('contact me@example.com please') as MdastRoot
  applyRemarkPlugins().runSync(tree)
  let mailtoCount = 0
  visit(tree, 'link', (node: Link) => {
    if (node.url.startsWith('mailto:')) mailtoCount += 1
  })
  assert(mailtoCount === 0, `expected no mailto links, got ${mailtoCount}`)
})

check('TOC ids match heading id algorithm (incl. duplicates + Chinese)', () => {
  const md = '# 你好 World\n\n## Dup\n\n## Dup\n\n# Foo'
  const toc = parseTocItems(md)
  const ids = collectHeadingIds(md)
  assert(toc.length === 4, `expected 4 toc items, got ${toc.length}`)
  assert(
    toc.map((t) => t.id).join(',') === ids.join(','),
    `toc/ids drift: toc=${toc.map((t) => t.id)} ids=${ids}`
  )
  assert(toc[0].id.length > 0, 'chinese slug should exist')
  assert(toc[1].id !== toc[2].id, 'duplicate headings need unique ids')
})

check('setext headings appear in TOC', () => {
  const md = 'Setext Title\n============\n\nBody'
  const toc = parseTocItems(md)
  assert(toc.length === 1, `expected setext heading in TOC, got ${toc.length}`)
  assert(toc[0].level === 1, 'setext === is h1')
})

check('==highlight== heading still in TOC', () => {
  const toc = parseTocItems('# Title with ==mark== text')
  assert(toc.length === 1, 'heading with mark still in TOC')
  assert(toc[0].text.includes('mark'), `expected mark text in TOC, got "${toc[0].text}"`)
})

check('extra blank lines become md-blank placeholders', () => {
  const out = preserveExtraBlankLines('a\n\n\n\nb')
  assert(out.includes('md-blank'), 'expected md-blank placeholder')
  assert((out.match(/md-blank/g) || []).length === 2, 'two extra blanks → two placeholders')
})

check('fenced code blank lines are not turned into placeholders', () => {
  const md = '```\nline\n\n\n\nline\n```'
  const out = preserveExtraBlankLines(md)
  assert(!out.includes('md-blank'), 'code fence internals must stay untouched')
})

if (process.exitCode) {
  console.error(`\nmarkdown-check: ${passed} passed, failures above`)
  process.exit(1)
}
console.log(`\nmarkdown-check: ${passed} passed`)
