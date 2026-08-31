import React, { useRef, useState } from 'react'
import { ArrowLeft, Edit3, Settings, Trash2, Menu, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useEscapeClose, useFocusTrap } from '@/hooks/Trap'

interface BarProps {
  title: string
  onBack: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSettings: () => void
  isDeleting?: boolean
  showNoteActions?: boolean
}

const Bar: React.FC<BarProps> = ({
  title,
  onBack,
  onEdit,
  onDelete,
  onSettings,
  isDeleting = false,
  showNoteActions = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useFocusTrap(menuOpen, menuRef)
  useEscapeClose(menuOpen, () => setMenuOpen(false))

  const closeMenu = () => setMenuOpen(false)

  const runAction = (action?: () => void) => {
    closeMenu()
    action?.()
  }

  return (
    <header className="border-b border-white/30 bg-white/30 shadow-sm backdrop-blur-md">
      <div className="w-full">
        <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <Button onClick={onBack} variant="primary" aria-label="返回">
            <ArrowLeft className="mr-2 size-4" />
            <span className="hidden sm:inline">返回</span>
          </Button>
          <div className="flex flex-1 justify-center px-2">
            <h1
              className="max-w-md truncate text-center font-semibold text-gray-900"
              style={{ fontSize: 'var(--global-font-size, 16px)' }}
            >
              {title}
            </h1>
          </div>

          <div className="hidden items-center space-x-4 md:flex">
            {showNoteActions && onEdit && onDelete && (
              <>
                <Button onClick={onEdit} variant="success">
                  <Edit3 className="mr-2 size-4" />
                  编辑
                </Button>
                <Button onClick={onDelete} variant="danger" loading={isDeleting}>
                  <Trash2 className="mr-2 size-4" />
                  删除
                </Button>
              </>
            )}
            <Button onClick={onSettings} variant="primary">
              <Settings className="mr-2 size-4" />
              设置
            </Button>
          </div>

          <div className="relative md:hidden">
            <Button
              onClick={() => setMenuOpen((open) => !open)}
              variant="ghost"
              size="lg"
              aria-label="打开菜单"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-black/20"
                  aria-label="关闭菜单"
                  onClick={closeMenu}
                />
                <div
                  ref={menuRef}
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-white/50 bg-white/95 py-2 shadow-lg backdrop-blur-md"
                >
                  {showNoteActions && onEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100"
                      onClick={() => runAction(onEdit)}
                    >
                      <Edit3 className="mr-2 size-4" />
                      编辑
                    </button>
                  )}
                  {showNoteActions && onDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
                      onClick={() => runAction(onDelete)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-2 size-4" />
                      删除
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100"
                    onClick={() => runAction(onSettings)}
                  >
                    <Settings className="mr-2 size-4" />
                    设置
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Bar
