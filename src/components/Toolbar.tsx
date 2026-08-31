import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical } from 'lucide-react'
import { toolbarInsert } from '@/lib/edIns'
import {
  orderToolbarTools,
  readToolbarOrder,
  saveToolbarOrder,
  type ToolbarTool,
} from '@/lib/toolbar'

const TOOLBAR_W = 192

interface EditorToolbarProps {
  embedded?: boolean
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ embedded = false }) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [toolOrder, setToolOrder] = useState(readToolbarOrder)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const skipInsertRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const tools = orderToolbarTools(toolOrder)

  const reorderTool = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return
    setToolOrder((prev) => {
      const fromIndex = prev.indexOf(fromId)
      const toIndex = prev.indexOf(toId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      saveToolbarOrder(next)
      return next
    })
  }, [])

  const toolbarStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '90vw',
        width: 'auto',
        background: 'rgba(255,255,255,0.20)',
        backdropFilter: 'blur(16px)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(255,255,255,0.30)',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: '8px',
        zIndex: 1100,
        pointerEvents: 'auto',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        whiteSpace: 'nowrap',
      }
    : {
        position: 'fixed',
        top: '4rem',
        left: 0,
        width: TOOLBAR_W,
        maxHeight: 'calc(100vh - 4rem - 1.5rem)',
        background: 'rgba(255,255,255,0.20)',
        backdropFilter: 'blur(16px)',
        borderRadius: embedded ? 0 : '8px',
        boxShadow: embedded
          ? 'none'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        border: embedded ? 'none' : '1px solid rgba(255,255,255,0.30)',
        borderRight: embedded ? '1px solid rgba(255,255,255,0.30)' : undefined,
        padding: embedded ? '12px 10px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '8px',
        zIndex: 1100,
        pointerEvents: 'auto',
        flexWrap: 'nowrap',
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        whiteSpace: 'nowrap',
      }

  const defaultTextColor = '#FFFFFF'

  const getButtonStyle = (dragging: boolean): React.CSSProperties => ({
    width: isMobile ? 'auto' : '100%',
    minWidth: isMobile ? '44px' : undefined,
    minHeight: isMobile ? '44px' : '40px',
    flexShrink: isMobile ? 0 : undefined,
    textAlign: 'left',
    padding: isMobile ? '10px 12px' : '8px 10px 8px 6px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: isMobile ? 'center' : 'flex-start',
    gap: isMobile ? 0 : '4px',
    backgroundColor: 'transparent',
    color: defaultTextColor,
    fontWeight: '500',
    fontSize: 'var(--global-font-size, 14px)',
    lineHeight: 1.4,
    transition: 'none',
    cursor: dragging ? 'grabbing' : 'pointer',
    border: 'none',
    outline: 'none',
    opacity: dragging ? 0.55 : 1,
  })

  const handleHoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
    e.currentTarget.style.color = defaultTextColor
    e.currentTarget.style.fontWeight = '500'
  }

  const handleHoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent'
    e.currentTarget.style.color = defaultTextColor
    e.currentTarget.style.fontWeight = '500'
  }

  const renderToolButton = (tool: ToolbarTool) => {
    const dragging = draggedId === tool.id
    return (
      <button
        key={tool.id}
        type="button"
        title={`${tool.title}（拖拽 ⋮⋮ 可排序）`}
        aria-label={tool.ariaLabel}
        draggable
        onDragStart={(e) => {
          skipInsertRef.current = true
          setDraggedId(tool.id)
          e.dataTransfer.setData('text/plain', tool.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => {
          setDraggedId(null)
          window.setTimeout(() => {
            skipInsertRef.current = false
          }, 0)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const fromId = e.dataTransfer.getData('text/plain')
          if (fromId) reorderTool(fromId, tool.id)
          setDraggedId(null)
        }}
        onMouseDown={(e) => {
          if (skipInsertRef.current) return
          if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
            e.preventDefault()
            return
          }
          toolbarInsert(e, tool.prefix, tool.suffix)
        }}
        style={getButtonStyle(dragging)}
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
      >
        {!isMobile && (
          <span
            data-drag-handle
            draggable
            aria-hidden
            title="拖拽排序"
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              setDraggedId(tool.id)
              e.dataTransfer.setData('text/plain', tool.id)
              e.dataTransfer.effectAllowed = 'move'
              e.stopPropagation()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              flexShrink: 0,
              cursor: 'grab',
              color: 'inherit',
              opacity: 0.65,
            }}
          >
            <GripVertical className="size-3.5" />
          </span>
        )}
        {!isMobile ? (
          <span style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                ...tool.iconStyle,
              }}
            >
              {tool.icon}
            </span>
            {tool.label}
          </span>
        ) : (
          tool.icon
        )}
      </button>
    )
  }

  const toolbar = (
    <div
      id="custom-toolbar"
      style={toolbarStyle}
      className="toolbar-fixed-width"
      data-width={`${TOOLBAR_W}px`}
      role="toolbar"
      aria-label="Markdown 格式工具栏"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          gap: '8px',
          flexWrap: 'nowrap',
        }}
      >
        {tools.map(renderToolButton)}
      </div>
    </div>
  )

  if (isMobile) {
    return createPortal(toolbar, document.body)
  }

  return (
    <>
      {createPortal(toolbar, document.body)}
      <aside className="hidden shrink-0 md:block" style={{ width: TOOLBAR_W }} aria-hidden />
    </>
  )
}

export default EditorToolbar
