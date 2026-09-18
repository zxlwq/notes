import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react'
import ReactMarkdown from 'react-markdown'
import { Edit3, FileText } from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import {
  markdownRemarkPlugins,
  markdownRemarkRehypeOptions,
  preprocessMarkdownContent,
} from '@/lib/markdown'
import { createDetailRehypePlugins } from '@/lib/detailMd'
import {
  highlightRangeInContent,
  isExternalUrl,
  parseTocItems,
  type HighlightRange,
} from '@/lib/mdView'
import Toc from '@/components/view/Toc'
import Img from '@/components/view/Img'
import CodePre from '@/components/view/CodePre'
import './Md.css'

const Mermaid = lazy(() => import('@/components/Mermaid'))

interface MdProps {
  noteId?: string
  content?: string
  rawContent?: string
  loading?: boolean
  onEdit?: () => void
  highlightRange?: HighlightRange | null
}

const Md: React.FC<MdProps> = ({
  noteId,
  content,
  rawContent,
  loading = false,
  onEdit,
  highlightRange = null,
}) => {
  const preIndexRef = useRef(0)
  const [contentRoot, setContentRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    preIndexRef.current = 0
  }, [noteId, content])

  const tocItems = useMemo(() => (content ? parseTocItems(content) : []), [content])
  const detailRehypePlugins = useMemo(() => createDetailRehypePlugins(tocItems), [tocItems])

  useEffect(() => {
    if (!highlightRange || !content || loading || !contentRoot) return

    let cancelled = false
    const source = rawContent || content

    const tryHighlight = (attempt = 0) => {
      if (cancelled) return
      const hit = highlightRangeInContent(contentRoot, highlightRange, source)
      if (!hit && attempt < 8) {
        window.setTimeout(() => tryHighlight(attempt + 1), 80 * (attempt + 1))
      }
    }

    const timer = window.setTimeout(() => tryHighlight(), 50)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [highlightRange, content, rawContent, loading, noteId, contentRoot])

  const renderHeading = useCallback(
    (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
      ({ id, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <Tag {...props} id={id ? String(id) : undefined}>
          {children}
        </Tag>
      ),
    []
  )

  const sourceContent = rawContent || content

  const components = useMemo(
    () => ({
      table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
        <div
          className="mb-4 overflow-x-auto overscroll-x-contain"
          role="region"
          aria-label="表格，可横向滚动"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <table {...props}>{children}</table>
        </div>
      ),
      h1: renderHeading('h1'),
      h2: renderHeading('h2'),
      h3: renderHeading('h3'),
      h4: renderHeading('h4'),
      h5: renderHeading('h5'),
      h6: renderHeading('h6'),
      a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
        const external = isExternalUrl(href)
        return (
          <a
            {...props}
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {children}
          </a>
        )
      },
      img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <Img src={src} alt={alt} {...props} />
      ),
      pre: ({ children }: { children?: React.ReactNode }) => {
        const idx = preIndexRef.current
        preIndexRef.current += 1
        return (
          <CodePre sourceContent={sourceContent} preIndex={idx}>
            {children}
          </CodePre>
        )
      },
      code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
        const isInline = !className
        if (isInline) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
        if (className?.includes('language-mermaid')) {
          const chart = String(children).replace(/\n$/, '')
          return (
            <Suspense
              fallback={
                <div className="my-4 rounded-md bg-white/40 p-2 text-sm text-white/70">
                  加载图表…
                </div>
              }
            >
              <Mermaid chart={chart} />
            </Suspense>
          )
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      },
    }),
    [renderHeading, sourceContent]
  )

  if (loading) {
    return (
      <div className="min-h-48 py-8">
        <Loading inline size="md" text="加载内容中..." />
      </div>
    )
  }

  if (!content) {
    return (
      <div className="md-empty">
        <FileText className="md-empty-icon size-12" aria-hidden />
        <h3 className="md-empty-title">暂无内容</h3>
        <p className="md-empty-desc">这个笔记还没有任何内容</p>
        {onEdit && (
          <Button onClick={onEdit} variant="success">
            <Edit3 className="mr-2 size-4" />
            开始编辑
          </Button>
        )}
      </div>
    )
  }

  preIndexRef.current = 0

  return (
    <div className="md-layout">
      <div className="md-main">
        <Toc items={tocItems} variant="mobile" contentRoot={contentRoot} />
        <div ref={setContentRoot} className="md-body prose" data-highlight-content>
          <ReactMarkdown
            key={noteId || content}
            remarkPlugins={markdownRemarkPlugins}
            remarkRehypeOptions={markdownRemarkRehypeOptions}
            rehypePlugins={detailRehypePlugins}
            components={components}
          >
            {preprocessMarkdownContent(content)}
          </ReactMarkdown>
        </div>
      </div>
      <Toc items={tocItems} variant="desktop" contentRoot={contentRoot} />
    </div>
  )
}

export default Md
