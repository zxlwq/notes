import React, { useCallback, useId, useRef } from 'react'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { useEscapeClose, useFocusTrap } from '@/hooks/Trap'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  type?: 'info' | 'success' | 'warning' | 'error'
  showCloseButton?: boolean
}

export interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  confirmText?: string
  onConfirm?: () => void
}

export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  type?: 'info' | 'success' | 'warning' | 'error'
}

export interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  onConfirm: (_value: string) => void
  onCancel?: () => void
}

export interface SelectModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  options: Array<{ value: string; label: string; description?: string }>
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  onConfirm: (_value: string) => void
  onCancel?: () => void
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  type = 'info',
  showCloseButton = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(isOpen, dialogRef)
  useEscapeClose(isOpen, onClose)

  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="size-6 text-green-600" />
      case 'warning':
        return <AlertTriangle className="size-6 text-yellow-600" />
      case 'error':
        return <AlertCircle className="size-6 text-red-600" />
      default:
        return <Info className="size-6 text-blue-600" />
    }
  }

  const getHeaderColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="关闭对话框"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="relative mx-4 w-full max-w-md rounded-lg border border-white/50 bg-white/50 shadow-xl backdrop-blur-xl"
      >
        <div
          className={`${getHeaderColor()} flex items-center justify-between border-b border-white/50 px-6 py-4`}
        >
          <div className="flex items-center gap-3">
            {getIcon()}
            <h3 id={titleId} className="font-semibold text-gray-900">
              {title}
            </h3>
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title = '提示',
  message,
  type = 'info',
  confirmText = '确定',
  onConfirm,
}) => {
  const handleConfirm = useCallback(() => {
    onConfirm?.()
    onClose()
  }, [onConfirm, onClose])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  React.useEffect(() => {
    if (isOpen) {
      const handleGlobalKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleConfirm()
        }
      }

      document.addEventListener('keydown', handleGlobalKeyPress)
      return () => {
        document.removeEventListener('keydown', handleGlobalKeyPress)
      }
    }
  }, [isOpen, handleConfirm])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} type={type}>
      <div className="space-y-4">
        <p className="text-gray-700">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={handleConfirm}
            onKeyDown={handleKeyPress}
            className={`rounded-md px-4 py-2 font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              type === 'error'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : type === 'warning'
                  ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                  : type === 'success'
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  title = '确认',
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'warning',
}) => {
  const handleConfirm = useCallback(() => {
    onConfirm()
    onClose()
  }, [onConfirm, onClose])

  const handleCancel = useCallback(() => {
    onCancel?.()
    onClose()
  }, [onCancel, onClose])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  React.useEffect(() => {
    if (isOpen) {
      const handleGlobalKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleConfirm()
        }
      }

      document.addEventListener('keydown', handleGlobalKeyPress)
      return () => {
        document.removeEventListener('keydown', handleGlobalKeyPress)
      }
    }
  }, [isOpen, handleConfirm])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} type={type}>
      <div className="space-y-4">
        <p className="text-gray-700">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            onKeyDown={handleKeyPress}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            onKeyDown={handleKeyPress}
            className={`rounded-md px-4 py-2 font-medium text-white transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              type === 'error'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : type === 'warning'
                  ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  title = '输入',
  message,
  placeholder = '请输入',
  defaultValue = '',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = React.useState(defaultValue)

  React.useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
    }
  }, [isOpen, defaultValue])

  const handleConfirm = () => {
    onConfirm(value)
    onClose()
  }

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} type="info">
      <div className="space-y-4">
        <p className="text-gray-700">{message}</p>
        <label htmlFor="modal-input" className="sr-only">
          输入
        </label>
        <input
          id="modal-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors duration-150 ease-in-out hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export const SelectModal: React.FC<SelectModalProps> = ({
  isOpen,
  onClose,
  title = '选择',
  message,
  options,
  defaultValue = '',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) => {
  const [selectedValue, setSelectedValue] = React.useState(defaultValue)

  React.useEffect(() => {
    if (isOpen) {
      setSelectedValue(defaultValue)
    }
  }, [isOpen, defaultValue])

  const handleConfirm = () => {
    onConfirm(selectedValue)
    onClose()
  }

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} type="info">
      <div className="space-y-4">
        <p className="text-gray-700">{message}</p>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start rounded-lg border p-3"
              style={{
                borderColor: selectedValue === option.value ? '#3b82f6' : '#e5e7eb',
                backgroundColor: selectedValue === option.value ? '#eff6ff' : '#ffffff',
                transition: 'none',
              }}
              onMouseEnter={(e) => {
                if (selectedValue !== option.value) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'
                  e.currentTarget.style.borderColor = '#d1d5db'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedValue !== option.value) {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }
              }}
            >
              <input
                type="radio"
                name="select-option"
                value={option.value}
                checked={selectedValue === option.value}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="mt-1 size-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="ml-3 flex-1">
                <div className="font-medium text-gray-900">{option.label}</div>
                {option.description && (
                  <div className="mt-1 text-gray-500">{option.description}</div>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            onKeyDown={handleKeyPress}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors duration-150 ease-in-out hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            onKeyDown={handleKeyPress}
            disabled={!selectedValue}
            className="rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-white transition-colors duration-150 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default Modal
