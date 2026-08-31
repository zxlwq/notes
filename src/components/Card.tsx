import React from 'react'
import { Trash2, Calendar, FileText, Tag, Share2, ChevronsUp, ChevronsDown } from 'lucide-react'
import { cn, getTagClassName } from '@/lib/utils'
import type { Note } from '@/types'

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
    onView(note)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(note.id)
  }

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    const shareUrl = window.location.origin + `/notes/${note.id}`

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        const successMessage = document.createElement('div')
        successMessage.textContent = '分享链接已复制'
        successMessage.className =
          'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md text-center'
        document.body.appendChild(successMessage)
        setTimeout(() => {
          document.body.removeChild(successMessage)
        }, 2000)
      })
      .catch((_error) => {
        console.error('复制失败')
      })
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
        'group cursor-pointer rounded-lg border border-white/30 bg-white/40 p-6 shadow-md backdrop-blur-lg transition-shadow duration-300 hover:border-white/40 hover:bg-white/42 hover:shadow-lg',
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
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
            {note.title || '无标题'}
          </h3>
          <div className="mt-1 flex items-center text-sm text-white">
            <Calendar className="mr-1 size-4" />
            <span>更新于 {formatDate(note.updatedAt)}</span>
          </div>
        </div>
        <div
          className="ml-2 flex items-center gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          style={{ transition: 'none' }}
        >
          {onMoveToTop && (
            <button
              type="button"
              onClick={handleMoveTop}
              disabled={!canMoveToTop}
              className="rounded-md p-1 text-gray-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
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
              className="rounded-md p-1 text-gray-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
              title="移到底部"
              aria-label={`移到底部：${note.title || '无标题'}`}
            >
              <ChevronsDown className="size-4" />
            </button>
          )}
          <button
            onClick={handleShareClick}
            className="rounded-md p-1 text-gray-400 hover:text-blue-600"
            title="分享笔记"
            aria-label={`分享笔记：${note.title || '无标题'}`}
          >
            <Share2 className="size-4" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="rounded-md p-1 text-gray-400 hover:text-red-600"
            title="删除笔记"
            aria-label={`删除笔记：${note.title || '无标题'}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-start">
        <FileText className="mr-2 mt-0.5 size-4 flex-shrink-0 text-white" />
        <p className="min-w-0 flex-1 overflow-hidden break-words text-sm leading-relaxed text-white">
          {getPreview(note.content)}
        </p>
      </div>

      {note.tags && note.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {note.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              role="button"
              tabIndex={0}
              aria-label={`按标签筛选：${tag}`}
              onClick={(e) => handleTagClick(e, tag)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleTagActivate(tag)
                }
              }}
              className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80',
                getTagClassName(tag)
              )}
            >
              <Tag className="mr-1 size-3" />
              {tag}
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
    </div>
  )
}

export default Card
