import React, { useRef, useState, useEffect } from 'react'
import type { TocItem } from '@/lib/mdView'
import { scrollToHeading } from '@/lib/viewScroll'

interface TocProps {
  items: TocItem[]
  variant: 'mobile' | 'desktop'
  contentRoot?: HTMLElement | null
}

const Toc: React.FC<TocProps> = ({ items, variant, contentRoot }) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    setActiveId(null)
  }, [items])

  if (items.length < 2) return null

  const handleClick = (e: React.MouseEvent, item: TocItem) => {
    e.preventDefault()
    setActiveId(item.id)
    scrollToHeading(item.id, contentRoot, 0, item.text)
    if (variant === 'mobile') {
      detailsRef.current?.removeAttribute('open')
    }
  }

  const list = (
    <ul className="md-toc-list">
      {items.map((item) => (
        <li key={item.id} className="md-toc-item">
          <a
            href={`#${item.id}`}
            className={`md-toc-link${activeId === item.id ? ' md-toc-link--active' : ''}`}
            data-level={String(item.level)}
            aria-current={activeId === item.id ? 'location' : undefined}
            onClick={(e) => handleClick(e, item)}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  )

  if (variant === 'mobile') {
    return (
      <nav className="md-toc md-toc--mobile" aria-label="目录">
        <details ref={detailsRef}>
          <summary>目录 ({items.length})</summary>
          {list}
        </details>
      </nav>
    )
  }

  return (
    <nav className="md-toc md-toc--desktop" aria-label="目录">
      <p className="md-toc-title">目录</p>
      {list}
    </nav>
  )
}

export default Toc
