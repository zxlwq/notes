import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return

    const root = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
        if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false
        // 固定定位弹层内 offsetParent 可能为 null，改用可见性判断
        const style = window.getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') return false
        return true
      })

    // 聚焦容器本身，禁止自动聚焦第一个 button（否则打开弹窗时的点击/空格会误激活）
    if (!root.hasAttribute('tabindex')) {
      root.tabIndex = -1
    }
    root.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    root.addEventListener('keydown', onKeyDown)
    return () => {
      root.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [active, containerRef])
}

export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, onClose])
}
