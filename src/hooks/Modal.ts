import { useState, useCallback } from 'react'

export interface ModalState {
  isOpen: boolean
  title?: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export interface PromptState {
  isOpen: boolean
  title?: string
  message: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  onConfirm?: (_value: string) => void
  onCancel?: () => void
}

export interface SelectState {
  isOpen: boolean
  title?: string
  message: string
  options: Array<{ value: string; label: string; description?: string }>
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  onConfirm?: (_value: string) => void
  onCancel?: () => void
}

export const useModal = () => {
  const [alertState, setAlertState] = useState<ModalState>({
    isOpen: false,
    message: '',
  })

  const [confirmState, setConfirmState] = useState<ModalState>({
    isOpen: false,
    message: '',
  })

  const [promptState, setPromptState] = useState<PromptState>({
    isOpen: false,
    message: '',
  })

  const [selectState, setSelectState] = useState<SelectState>({
    isOpen: false,
    message: '',
    options: [],
  })

  const showAlert = useCallback(
    (message: string, options: Omit<ModalState, 'isOpen' | 'message'> = {}) => {
      setAlertState({
        isOpen: true,
        title: options.title || '提示',
        message: message,
        type: options.type || 'info',
        confirmText: options.confirmText || '确定',
        onConfirm: options.onConfirm,
      })
    },
    []
  )

  const showConfirm = useCallback(
    (message: string, options: Omit<ModalState, 'isOpen' | 'message'>): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({
          isOpen: true,
          title: options.title || '确认',
          message,
          type: options.type || 'warning',
          confirmText: options.confirmText || '确定',
          cancelText: options.cancelText || '取消',
          onConfirm: () => {
            resolve(true)
          },
          onCancel: () => {
            resolve(false)
          },
        })
      })
    },
    []
  )

  const showPrompt = useCallback((options: Omit<PromptState, 'isOpen'>) => {
    setPromptState({
      isOpen: true,
      title: options.title || '输入',
      message: options.message,
      placeholder: options.placeholder || '请输入',
      defaultValue: options.defaultValue || '',
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    })
  }, [])

  const showSelect = useCallback(
    (message: string, options: Omit<SelectState, 'isOpen' | 'message'>): Promise<string | null> => {
      return new Promise((resolve) => {
        setSelectState({
          isOpen: true,
          title: options.title || '选择',
          message,
          options: options.options,
          defaultValue: options.defaultValue || '',
          confirmText: options.confirmText || '确定',
          cancelText: options.cancelText || '取消',
          onConfirm: (value: string) => {
            resolve(value)
          },
          onCancel: () => {
            resolve(null)
          },
        })
      })
    },
    []
  )

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const closePrompt = useCallback(() => {
    setPromptState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const closeSelect = useCallback(() => {
    setSelectState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  return {
    alertState,
    confirmState,
    promptState,
    selectState,

    showAlert,
    showConfirm,
    showPrompt,
    showSelect,
    closeAlert,
    closeConfirm,
    closePrompt,
    closeSelect,
  }
}

class ModalManager {
  private static instance: ModalManager
  private modalHook: ReturnType<typeof useModal> | null = null

  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager()
    }
    return ModalManager.instance
  }

  setModalHook(hook: ReturnType<typeof useModal>) {
    this.modalHook = hook
  }

  alert(message: string, options?: Partial<Omit<ModalState, 'isOpen' | 'message'>>) {
    if (this.modalHook) {
      this.modalHook.showAlert(message, options)
    } else {
      window.alert(message)
    }
  }

  confirm(
    message: string,
    options?: Partial<Omit<ModalState, 'isOpen' | 'message'>>
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.modalHook) {
        this.modalHook.showConfirm(message, {
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
          ...options,
        })
      } else {
        resolve(window.confirm(message))
      }
    })
  }

  prompt(
    message: string,
    defaultValue?: string,
    options?: Partial<Omit<PromptState, 'isOpen' | 'message'>>
  ): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.modalHook) {
        this.modalHook.showPrompt({
          message,
          defaultValue: defaultValue || '',
          onConfirm: (value) => resolve(value),
          onCancel: () => resolve(null),
          ...options,
        })
      } else {
        const result = window.prompt(message, defaultValue)
        resolve(result)
      }
    })
  }
}

export const modalManager = ModalManager.getInstance()
