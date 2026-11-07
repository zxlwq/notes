import React from 'react'
import { langFromClass } from '@/lib/mdView'

interface CodePreProps {
  children: React.ReactNode
}

const CodePre: React.FC<CodePreProps> = ({ children }) => {
  const child = React.Children.only(children) as React.ReactElement<{ className?: string }>
  const lang = langFromClass(child?.props?.className)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    const button = e.currentTarget as HTMLElement
    const wrap = button.closest('.md-pre-wrap')
    const pre = wrap?.querySelector('pre') ?? button.closest('pre')
    const codeEl = pre?.querySelector('code')
    const cleanContent = (codeEl?.textContent ?? pre?.textContent ?? '').replace(/\n+$/, '')

    void navigator.clipboard.writeText(cleanContent)

    const toast = document.createElement('div')
    toast.textContent = '已复制！'
    toast.className =
      'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
    document.body.appendChild(toast)
    setTimeout(() => document.body.removeChild(toast), 2000)
  }

  return (
    <div className="md-pre-wrap" data-lang={lang || undefined}>
      {lang ? <span className="md-pre-lang">{lang}</span> : null}
      <button type="button" className="md-copy-btn" aria-label="复制代码" onClick={handleCopy}>
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25v-7.5Z" />
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25v-7.5Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-7.5Z" />
        </svg>
      </button>
      <pre className="md-pre">{children}</pre>
    </div>
  )
}

export default CodePre
