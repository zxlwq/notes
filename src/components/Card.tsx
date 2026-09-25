import React, { useState } from 'react'
import { Trash2, Calendar, FileText, Tag, Share2, ChevronsUp, ChevronsDown } from 'lucide-react'
import { cn, getTagClassName } from '@/lib/utils'
import type { Note } from '@/types'
import ShareDialog from '@/components/ShareDialog'

interface CardProps {
  note: Note
  onView: (_note: Note) => void
  onTagClick?: (_note: Note, _tag: string) => void
  onDelete: (_noteId: string) => void
  onDragStart?: (_e: React.DragEvent, _noteId: string) => void
  onDragEnd?: (_e: React.DragEvent) => void
  onDragOver?: (_e: React.DragEvent) => void
  onDrop?: (_e: React.DragEvent, _noteId: string) => void
  onMoveToTop?: (_noteId: string) => void
  onMoveToBottom?: (_noteId: string) => void
  canMoveToTop?: boolean
  canMoveToBottom?: boolean
  className?: string
}

const Card: React.FC<CardProps> = ({
  note,
  onView,
  onTagClick,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveToTop,
  onMoveToBottom,
  canMoveToTop = false,
  canMoveToBottom = false,
  className,
}) => {
  const [shareOpen, setShareOpen] = useState(false)
  const [shareKey, setShareKey] = useState(0)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPreview = (content: string | undefined) => {
    if (!content) return '点击查看详情'

    const cleanContent = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()

    return cleanContent.length > 100 ? cleanContent.substring(0, 100) + '...' : cleanContent
  }

  const handleCardClick = () => {
    if (shareOpen) return
    onView(note)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(note.id)
  }

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // 等当前指针事件结束再挂载弹窗，避免同一次点击落到弹窗内的提交按钮上
    window.setTimeout(() => {
      setShareKey((k) => k + 1)
      setShareOpen(true)
    }, 0)
  }

  const handleTagActivate = (tag: string) => {
    if (onTagClick) {
      onTagClick(note, tag)
    } else {
      onView(note)
    }
  }

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation()
    handleTagActivate(tag)
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', note.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(e, note.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onDragOver?.(e)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onDrop?.(e, note.id)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).style.opacity = '1'
    onDragEnd?.(e)
  }

  const handleMoveTop = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMoveToTop?.(note.id)
  }

  const handleMoveBottom = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMoveToBottom?.(note.id)
  }

  return (
    <div
      className={cn(
        'group min-w-0 cursor-pointer overflow-hidden rounded-lg border border-white/30 bg-white/40 p-6 shadow-md backdrop-blur-lg transition-shadow duration-300 hover:border-white/40 hover:bg-white/42 hover:shadow-lg',
        className
      )}
      onClick={handleCardClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label={`笔记：${note.title || '无标题'}，可拖拽或使用排序按钮调整顺序`}
    >
      <div className="mb-3">
        <h3 className="truncate text-xl font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
          {note.title || '无标题'}
        </h3>
        <div className="mt-1 flex items-center whitespace-nowrap text-sm text-white">
          <Calendar className="mr-1 size-4 shrink-0" />
          <span className="whitespace-nowrap">更新于 {formatDate(note.updatedAt)}</span>
        </div>
      </div>

      <div className="mb-3 flex items-start">
        <FileText className="mr-2 mt-0.5 size-4 flex-shrink-0 text-white" />
        <p className="min-w-0 flex-1 overflow-hidden break-words text-sm leading-relaxed text-white">
          {getPreview(note.content)}
        </p>
      </div>

      {note.tags && note.tags.length > 0 && (
        <div className="mb-3 flex min-w-0 max-w-full flex-wrap gap-1">
          {note.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              role="button"
              tabIndex={0}
              aria-label={`按标签筛选：${tag}`}
              title={tag}
              onClick={(e) => handleTagClick(e, tag)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleTagActivate(tag)
                }
              }}
              className={cn(
                'inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-full border px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80',
                getTagClassName(tag)
              )}
            >
              <Tag className="mr-1 size-3 shrink-0" />
              <span className="min-w-0 truncate">{tag}</span>
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 px-2 py-1 text-xs font-medium text-white">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/30 pt-2 text-xs text-white">
        <span>字数: {note.contentLength ?? note.content?.length ?? 0}</span>
        <span>创建于 {formatDate(note.createdAt)}</span>
      </div>
      <div
        className="mt-2 flex items-stretch gap-2 border-t border-white/30 pt-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        style={{ transition: 'none' }}
      >
        {onMoveToTop && (
          <button
            type="button"
            onClick={handleMoveTop}
            disabled={!canMoveToTop}
            className="flex flex-1 items-center justify-center rounded-md px-3 py-2 text-gray-400 transition-none hover:!text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:!text-gray-400"
            title="移到顶部"
            aria-label={`移到顶部：${note.title || '无标题'}`}
          >
            <ChevronsUp className="size-4" />
          </button>
        )}
        {onMoveToBottom && (
          <button
            type="button"
            onClick={handleMoveBottom}
            disabled={!canMoveToBottom}
            className="flex flex-1 items-center justify-center rounded-md px-3 py-2 text-gray-400 transition-none hover:!text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:!text-gray-400"
            title="移到底部"
            aria-label={`移到底部：${note.title || '无标题'}`}
          >
            <ChevronsDown className="size-4" />
          </button>
        )}
        <button
          onClick={handleShareClick}
          className="flex flex-1 items-center justify-center rounded-md px-3 py-2 text-gray-400 transition-none hover:!text-blue-600"
          title="分享笔记"
          aria-label={`分享笔记：${note.title || '无标题'}`}
        >
          <Share2 className="size-4" />
        </button>
        <button
          onClick={handleDeleteClick}
          className="flex flex-1 items-center justify-center rounded-md px-3 py-2 text-gray-400 transition-none hover:!text-red-600"
          title="删除笔记"
          aria-label={`删除笔记：${note.title || '无标题'}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {shareOpen ? (
        <ShareDialog
          key={shareKey}
          isOpen
          onClose={() => setShareOpen(false)}
          note={note}
          ensureContent
        />
      ) : null}
    </div>
  )
}

export default Card
