import React from 'react'
import { Share2, Tag } from 'lucide-react'
import type { Note } from '@/types'
import { copyShareUrl, formatNoteDate } from '@/lib/viewScroll'

interface MetaProps {
  note: Note
  onTagClick: (tag: string) => void
}

const Meta: React.FC<MetaProps> = ({ note, onTagClick }) => (
  <div className="mb-6">
    <div className="mb-4 flex items-start justify-between">
      <h1
        data-note-title
        className="flex-1 font-bold text-gray-900"
        style={{ fontSize: 'calc(var(--global-font-size, 16px) * 1.5)' }}
      >
        {note.title || '无标题'}
      </h1>
      <button
        onClick={() => copyShareUrl(note.id)}
        className="ml-4 rounded-md p-2 text-gray-400 transition-colors hover:text-blue-500"
        title="分享笔记"
      >
        <Share2 className="size-5" />
      </button>
    </div>

    <div className="mb-4 flex items-center space-x-6 text-white">
      <div className="flex items-center">
        <span className="font-medium">创建时间：</span>
        <span>{formatNoteDate(note.createdAt)}</span>
      </div>
      <div className="flex items-center">
        <span className="font-medium">更新时间：</span>
        <span>{formatNoteDate(note.updatedAt)}</span>
      </div>
      <div className="flex items-center">
        <span className="font-medium">字数：</span>
        <span>{note.content?.length ?? note.contentLength ?? 0}</span>
      </div>
    </div>

    {note.tags && note.tags.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {note.tags.map((tag, index) => (
          <button
            key={index}
            onClick={() => onTagClick(tag)}
            className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800"
          >
            <Tag className="mr-1 size-4" />
            {tag}
          </button>
        ))}
      </div>
    )}
  </div>
)

export default Meta
