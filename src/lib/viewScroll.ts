import { slugify } from '@/lib/utils'
import { highlightRangeInContent, normalizeHeadingText, type HighlightRange } from '@/lib/mdView'

function clearHeadingFlash(root?: ParentNode | null) {
  const scope = root ?? document
  scope.querySelectorAll('.md-heading-flash').forEach((el) => {
    el.classList.remove('md-heading-flash')
  })
}

function flashHighlight(el: HTMLElement, root?: ParentNode | null) {
  clearHeadingFlash(root)
  void el.offsetWidth
  el.classList.add('md-heading-flash')
  const onEnd = () => {
    el.classList.remove('md-heading-flash')
    el.removeEventListener('animationend', onEnd)
  }
  el.addEventListener('animationend', onEnd)
}

const HEADING_SCROLL_OFFSET = 88

function findHeadingElement(
  id: string,
  root?: HTMLElement | null,
  label?: string
): HTMLElement | null {
  const byId = document.getElementById(id)
  if (byId) return byId

  if (root) {
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      if ((heading as HTMLElement).id === id) return heading as HTMLElement
    }
  }

  if (root && label) {
    const target = normalizeHeadingText(label).toLowerCase()
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      const text = normalizeHeadingText(heading.textContent || '').toLowerCase()
      if (text === target) return heading as HTMLElement
    }
  }

  return null
}

function scrollElementIntoView(target: HTMLElement) {
  const top = target.getBoundingClientRect().top + window.scrollY - HEADING_SCROLL_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

/** 滚动到标题并高亮；优先在正文容器内查找 */
export function scrollToHeading(
  id: string,
  root?: HTMLElement | null,
  attempt = 0,
  label?: string
): boolean {
  const target = findHeadingElement(id, root, label)

  if (!target && attempt < 8) {
    window.setTimeout(() => scrollToHeading(id, root, attempt + 1, label), 100)
    return false
  }
  if (!target) return false

  scrollElementIntoView(target)
  flashHighlight(target, root)
  return true
}

export function scrollToTag(tag: string, attempt = 0) {
  const id = slugify(tag)
  const container = document.querySelector('.md-body')
  const target = document.getElementById(id)
  if (target) {
    scrollElementIntoView(target)
    flashHighlight(target, container ?? undefined)
    return
  }

  if (!container) {
    if (attempt < 8) {
      setTimeout(() => scrollToTag(tag, attempt + 1), 100)
    }
    return
  }

  const blocks = container.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,strong,em,a,code,pre'
  )
  for (const block of Array.from(blocks)) {
    const text = (block.textContent || '').trim()
    if (text && text.includes(tag)) {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' })
      flashHighlight(block as HTMLElement, container)
      return
    }
  }
}

/** @deprecated 请通过 Md 组件的 highlightRange 属性高亮 */
export function highlightAndScrollToText(highlightPosition: HighlightRange) {
  setTimeout(() => {
    const root = document.querySelector('[data-highlight-content]') as HTMLElement | null
    if (!root) return
    highlightRangeInContent(root, highlightPosition)
  }, 100)
}

export function copyShareUrl(noteId: string) {
  const shareUrl = window.location.origin + `/notes/${noteId}`
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
    .catch((error) => {
      console.error('复制失败:', error)
    })
}

export function formatNoteDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
