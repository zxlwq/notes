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

const TOOLBAR_W = '12rem'

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

  const inFlow = embedded && !isMobile

  const toolbarStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '90vw',
        width: 'auto',
        background: 'rgba(255,255,255,0.20)',
        backdropFilter: 'blur(16px)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        border: '1px solid rgba(255,255,255,0.30)',
        padding: '0.5rem 0.75rem',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: '0.5rem',
        zIndex: 40,
        pointerEvents: 'auto',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        whiteSpace: 'nowrap',
      }
    : inFlow
      ? {
          position: 'relative',
          top: 'auto',
          left: 'auto',
          width: TOOLBAR_W,
          minWidth: TOOLBAR_W,
          maxWidth: TOOLBAR_W,
          height: '100%',
          maxHeight: '100%',
          alignSelf: 'stretch',
          background: 'transparent',
          backdropFilter: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.30)',
          padding: '0.75rem 0.625rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '0.5rem',
          zIndex: 'auto',
          pointerEvents: 'auto',
          flexWrap: 'nowrap',
          overflowX: 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }
      : {
          position: 'fixed',
          top: '4rem',
          left: 0,
          width: TOOLBAR_W,
          maxHeight: 'calc(100vh - 5.5rem)',
          background: 'rgba(255,255,255,0.20)',
          backdropFilter: 'blur(16px)',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(255,255,255,0.30)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '0.5rem',
          zIndex: 40,
          pointerEvents: 'auto',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          whiteSpace: 'nowrap',
        }

  const defaultTextColor = 'var(--theme-text, #111827)'

  const getButtonStyle = (dragging: boolean): React.CSSProperties => ({
    width: isMobile ? 'auto' : '100%',
    minWidth: isMobile ? '2.75rem' : undefined,
    minHeight: isMobile ? '2.75rem' : '2.5rem',
    flexShrink: isMobile ? 0 : undefined,
    textAlign: 'left',
    padding: isMobile ? '0.625rem 0.75rem' : '0.5rem 0.625rem 0.5rem 0.375rem',
    borderRadius: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: isMobile ? 'center' : 'flex-start',
    gap: isMobile ? 0 : '0.25rem',
    backgroundColor: 'transparent',
    color: defaultTextColor,
    fontWeight: '500',
    fontSize: '1rem',
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
              width: '1.125rem',
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
                width: '1rem',
                height: '1rem',
                marginRight: '0.5rem',
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
      className={inFlow ? 'toolbar-embedded' : 'toolbar-fixed-width'}
      data-width={TOOLBAR_W}
      data-embedded={inFlow ? 'true' : undefined}
      role="toolbar"
      aria-label="Markdown 格式工具栏"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          gap: 0,
          flexWrap: 'nowrap',
        }}
      >
        {tools.map((tool, index) => (
          <div key={tool.id} style={{ display: 'contents' }}>
            {index > 0 && (
              <div
                aria-hidden
                style={
                  isMobile
                    ? {
                        width: 1,
                        alignSelf: 'stretch',
                        margin: '0.25rem 0.375rem',
                        background: 'var(--theme-line, rgba(255,255,255,0.3))',
                        flexShrink: 0,
                      }
                    : {
                        height: 1,
                        width: '100%',
                        margin: '0.25rem 0',
                        background: 'var(--theme-line, rgba(255,255,255,0.3))',
                        flexShrink: 0,
                      }
                }
              />
            )}
            {renderToolButton(tool)}
          </div>
        ))}
      </div>
    </div>
  )

  // 移动端：底部浮动条
  if (isMobile) {
    return createPortal(toolbar, document.body)
  }

  // 嵌入编辑卡片：文档流内排版，不再 fixed 脱出容器
  if (inFlow) {
    return toolbar
  }

  // 非嵌入桌面：fixed + 占位
  return (
    <>
      {createPortal(toolbar, document.body)}
      <aside className="hidden shrink-0 md:block" style={{ width: TOOLBAR_W }} aria-hidden />
    </>
  )
}

export default EditorToolbar
