import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import SimpleMDE from 'react-simplemde-editor'
import 'easymde/dist/easymde.min.css'
import './Editor.css'
import { renderEditorPreviewHtml } from '@/lib/markdown'
import { setMarkdownInserter } from '@/lib/edIns'

interface CursorPos {
  line: number
  ch: number
}

interface CodeMirrorDoc {
  indexFromPos: (pos: CursorPos) => number
  posFromIndex: (index: number) => CursorPos
  lastLine: () => number
  getLine: (line: number) => string
}

interface CodeMirrorInstance {
  getValue: () => string
  setValue: (value: string) => void
  getCursor: (which?: 'from' | 'to' | 'anchor' | 'head') => CursorPos
  setCursor: (cursor: CursorPos) => void
  focus: () => void
  getSelection: () => string
  replaceSelection: (text: string) => void
  replaceRange: (text: string, from: CursorPos, to?: CursorPos) => void
  refresh: () => void
  getDoc: () => CodeMirrorDoc
  lineCount: () => number
  operation: (fn: () => void) => void
  getWrapperElement: () => HTMLElement
  getInputField: () => HTMLTextAreaElement
  on: (event: string, handler: () => void) => void
  off: (event: string, handler: () => void) => void
}

interface EditorProps {
  value: string
  onChange: (_value: string) => void
  placeholder?: string
  tags?: string[]
  onTagsChange?: (_tags: string[]) => void
  tagInput?: string
  onTagInputChange?: (_value: string) => void
  onAddTag?: () => void
  onRemoveTag?: (_tag: string) => void
  onTagInputKeyPress?: (_e: React.KeyboardEvent) => void
}

function resolveCm(
  cmRef: React.MutableRefObject<CodeMirrorInstance | null>,
  mdeRef: React.MutableRefObject<{ codemirror: CodeMirrorInstance } | null>
): CodeMirrorInstance | null {
  const fromMde = mdeRef.current?.codemirror ?? null
  if (fromMde) {
    cmRef.current = fromMde
    return fromMde
  }
  if (cmRef.current) return cmRef.current
  const el = document.querySelector('.notes-editor-container .CodeMirror') as
    | (HTMLElement & { CodeMirror?: CodeMirrorInstance })
    | null
  const cm = el?.CodeMirror ?? null
  if (cm) cmRef.current = cm
  return cm
}

/** 空文档有时会被 CM 变成 "\\n"（两行），导致插入落到第二行 */
function collapseBlankDoc(cm: CodeMirrorInstance, doc: CodeMirrorDoc) {
  const val = cm.getValue()
  if (val !== '' && val !== '\n') return

  for (let i = 0; i <= doc.lastLine(); i++) {
    if (doc.getLine(i) !== '') return
  }

  cm.setValue('')
  cm.setCursor({ line: 0, ch: 0 })
}

function clampCursor(doc: CodeMirrorDoc, pos: CursorPos): CursorPos {
  const line = Math.max(0, Math.min(pos.line, doc.lastLine()))
  const ch = Math.max(0, Math.min(pos.ch, doc.getLine(line).length))
  return { line, ch }
}

const Editor: React.FC<EditorProps> = ({
  value,
  onChange,
  placeholder = '开始编写您的笔记...',
  tags = [],
  onTagsChange: _onTagsChange,
  tagInput = '',
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onTagInputKeyPress,
}) => {
  const cmRef = useRef<CodeMirrorInstance | null>(null)
  const mdeRef = useRef<{ codemirror: CodeMirrorInstance } | null>(null)
  const cursorPosRef = useRef<CursorPos>({ line: 0, ch: 0 })
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const placeholderRef = useRef(placeholder)
  const [cmReady, setCmReady] = useState(false)

  onChangeRef.current = onChange
  valueRef.current = value
  placeholderRef.current = placeholder

  const bindCodemirror = useCallback((cm: CodeMirrorInstance) => {
    cmRef.current = cm
    const doc = cm.getDoc()
    collapseBlankDoc(cm, doc)
    cursorPosRef.current = clampCursor(doc, cm.getCursor())
    const input = cm.getInputField()
    input.id = 'notes-editor-content'
    input.name = 'content'
    input.setAttribute('aria-label', placeholderRef.current || '笔记内容')
    setCmReady(true)
  }, [])

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue)
    },
    [onChange]
  )

  const bindMde = useCallback(
    (mde: { codemirror: CodeMirrorInstance }) => {
      mdeRef.current = mde
      bindCodemirror(mde.codemirror)
    },
    [bindCodemirror]
  )

  const insertText = useCallback((before: string, after: string) => {
    const cm = resolveCm(cmRef, mdeRef)
    if (cm) {
      const doc = cm.getDoc()
      const selection = cm.getSelection()

      cm.operation(() => {
        collapseBlankDoc(cm, doc)

        if (selection) {
          const from = clampCursor(doc, cm.getCursor('from'))
          const startIndex = doc.indexFromPos(from)
          cm.setCursor(from)
          cm.replaceSelection(before + selection + after)
          const caret = doc.posFromIndex(startIndex + before.length + selection.length)
          cm.setCursor(caret)
          cursorPosRef.current = caret
          return
        }

        const from = clampCursor(doc, cm.getCursor())
        cm.setCursor(from)
        const startIndex = doc.indexFromPos(from)
        cm.replaceSelection(before + after)
        const caret = doc.posFromIndex(startIndex + before.length)
        cm.setCursor(caret)
        cursorPosRef.current = caret
      })

      cm.focus()
      cm.refresh()
      return
    }

    onChangeRef.current(`${valueRef.current ?? ''}${before}${after}`)
  }, [])

  useEffect(() => {
    setMarkdownInserter(insertText)
    return () => setMarkdownInserter(null)
  }, [insertText])

  useEffect(() => {
    const cm = cmRef.current
    if (!cm || value !== '') return
    collapseBlankDoc(cm, cm.getDoc())
  }, [value, cmReady])

  const options = useMemo(() => {
    return {
      placeholder,
      spellChecker: false,
      status: false,
      autofocus: false,
      lineWrapping: true,
      autoDownloadFontAwesome: false,
      renderingConfig: {
        singleLineBreaks: true,
        codeSyntaxHighlighting: true,
      },
      previewRender: renderEditorPreviewHtml,
      autosave: {
        enabled: false,
        uniqueId: 'notes-editor',
      },
      toolbar: false,
      cursorBlinkRate: 530,
      cursorHeight: 1.2,
      theme: 'default',
      lineNumbers: false,
      cursorScrollMargin: 0,
      direction: 'ltr' as const,
      rtlMoveVisually: false,
      showCursorWhenSelecting: true,
      electricChars: false,
      smartIndent: false,
      indentUnit: 0,
    }
  }, [placeholder])

  useEffect(() => {
    const cm = cmRef.current
    if (!cm) return

    collapseBlankDoc(cm, cm.getDoc())
    cm.setCursor({ line: 0, ch: 0 })
    cursorPosRef.current = { line: 0, ch: 0 }
    cm.focus()

    const trackCursor = () => {
      cursorPosRef.current = cm.getCursor()
    }

    cm.on('cursorActivity', trackCursor)
    return () => {
      cm.off('cursorActivity', trackCursor)
    }
  }, [cmReady])

  useEffect(() => {
    const cm = cmRef.current
    if (!cm) return

    const handlePasteEvent = (event: ClipboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      try {
        const clipboardData = event.clipboardData?.getData('text/plain') || ''
        const processedText = clipboardData.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const cursor = cm.getCursor()
        const selection = cm.getSelection()

        if (selection) {
          cm.replaceSelection(processedText)
        } else {
          cm.replaceRange(processedText, cursor)
        }

        onChange(cm.getValue())
        cm.setCursor(cm.getCursor())
        cm.focus()
      } catch (error) {
        console.warn('粘贴处理失败:', error)
      }
    }

    const wrapper = cm.getWrapperElement()
    wrapper.addEventListener('paste', handlePasteEvent, true)

    return () => {
      wrapper.removeEventListener('paste', handlePasteEvent, true)
    }
  }, [cmReady, onChange])

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const cm = cmRef.current
      if (cm) {
        cm.focus()
        cm.refresh()
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [cmReady])

  useEffect(() => {
    const applySettingsFromStorage = () => {
      try {
        const saved = localStorage.getItem('app-settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          const fontSizeMap: Record<string, string> = {
            小: '14px',
            中: '16px',
            大: '18px',
            特大: '20px',
            超大: '22px',
          }
          const resolvedFontSize =
            fontSizeMap[parsed.fontSize as keyof typeof fontSizeMap] || '14px'
          const resolvedLineHeight = '1.6'

          document.documentElement.style.setProperty('--global-font-size', resolvedFontSize)
          document.documentElement.style.setProperty('--global-line-height', resolvedLineHeight)

          document.documentElement.style.setProperty('--editor-font-size', resolvedFontSize)
          document.documentElement.style.setProperty('--editor-line-height', resolvedLineHeight)
          const bg = parsed.backgroundImageUrl?.trim()
          if (bg) {
            document.documentElement.style.setProperty('--app-bg-image', `url('${bg}')`)
          } else {
            document.documentElement.style.removeProperty('--app-bg-image')
          }
          const familyMap: Record<string, string> = {
            默认: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
            宋体: "'SimSun', 'Songti SC', 'Noto Serif SC', serif",
            楷体: "'KaiTi', 'Kaiti SC', 'STKaiti', 'Noto Serif SC', serif",
            黑体: "'Heiti SC', 'SimHei', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
            微软雅黑: "'Microsoft YaHei', 'Noto Sans SC', sans-serif",
            思源黑体: "'Noto Sans SC', 'Source Han Sans SC', sans-serif",
            思源宋体: "'Noto Serif SC', 'Source Han Serif SC', serif",
            苹方: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
            仿宋: "'FangSong', 'FZSongYi-Z13', 'Songti SC', 'Noto Serif SC', serif",
            隶书: "'LiSu', 'STLiti', 'KaiTi', 'Noto Serif SC', serif",
          }
          const resolvedFamily =
            familyMap[parsed.fontFamily as keyof typeof familyMap] || familyMap['默认']
          document.documentElement.style.setProperty('--editor-font-family', resolvedFamily)
        }
      } catch {}
    }

    applySettingsFromStorage()

    const handler = () => applySettingsFromStorage()
    window.addEventListener('settings-changed', handler as EventListener)
    return () => {
      window.removeEventListener('settings-changed', handler as EventListener)
    }
  }, [])

  return (
    <div className="notes-editor-container">
      <div
        className="ed-tags"
        style={{
          background: 'rgba(255,255,255,0.1)',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {onAddTag && onTagInputChange && onTagInputKeyPress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <label htmlFor="tag-input" className="sr-only">
              添加标签
            </label>
            <input
              id="tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => onTagInputChange(e.target.value)}
              onKeyPress={onTagInputKeyPress}
              placeholder="添加标签..."
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '2px solid rgba(59, 130, 246, 0.6)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                color: '#ffffff',
                outline: 'none',
                width: '120px',
                transition: 'all 0.2s ease',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.2)',
              }}
              onFocus={(e) => {
                e.target.style.border = '2px solid rgba(59, 130, 246, 0.8)'
                e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)'
              }}
              onBlur={(e) => {
                e.target.style.border = '2px solid rgba(59, 130, 246, 0.6)'
                e.target.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.2)'
              }}
            />
            <button
              onClick={onAddTag}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '2px solid rgba(59, 130, 246, 0.6)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                minWidth: '32px',
                textAlign: 'center',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.1)',
              }}
            >
              +
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            flex: '1',
            justifyContent: 'flex-end',
          }}
        >
          {tags && tags.length > 0 && (
            <>
              {tags.map((tag, index) => (
                <span
                  key={index}
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  🏷️ {tag}
                  {onRemoveTag && (
                    <button
                      onClick={() => onRemoveTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        padding: '0',
                        marginLeft: '4px',
                        fontSize: '12px',
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <div style={{ minHeight: '550px' }}>
        <SimpleMDE
          value={value}
          onChange={handleChange}
          options={options}
          getCodemirrorInstance={bindCodemirror}
          getMdeInstance={bindMde}
          key="stable-editor"
        />
      </div>

      <style>{`
        .notes-editor-container { 
          overflow-x: hidden !important; 
          overflow-y: visible !important;
        }
        
        .notes-editor-container {
          position: relative !important;
          transform: none !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          bottom: auto !important;
          z-index: auto !important;
        }
        .notes-editor-container .CodeMirror,
        .notes-editor-container .CodeMirror-scroll,
        .notes-editor-container .CodeMirror-wrap,
        .notes-editor-container .CodeMirror-wrap .CodeMirror-scroll { overflow-x: hidden !important; }
        .notes-editor-container .editor-statusbar { display: none !important; border: none !important; box-shadow: none !important; background: transparent !important; height: 0 !important; padding: 0 !important; }
        .notes-editor-container .CodeMirror { border: none !important; box-shadow: none !important; }
        .notes-editor-container .editor-toolbar { border-bottom: none !important; }
        .notes-editor-container .CodeMirror-hscrollbar,
        .notes-editor-container .CodeMirror-hscrollbar > div { display: none !important; height: 0 !important; }
        .notes-editor-container .CodeMirror-sizer { min-width: 0 !important; }
        .notes-editor-container .editor-preview,
        .notes-editor-container .editor-preview-side { overflow-x: hidden !important; }
        .notes-editor-container .CodeMirror pre { 
          white-space: pre-wrap !important; 
          word-wrap: break-word !important; 
          word-break: break-all !important;
          overflow-wrap: break-word !important;
        }
        .notes-editor-container .CodeMirror, .notes-editor-container .editor-toolbar, .notes-editor-container .editor-statusbar { background: transparent !important; }
        .notes-editor-container .CodeMirror-gutters { background: transparent !important; border: none !important; }
        
        .notes-editor-container .CodeMirror .CodeMirror-cursor {
          border-left: 2px solid #3b82f6 !important;
          border-right: none !important;
        }
        
        .notes-editor-container .CodeMirror.CodeMirror-focused .CodeMirror-cursor {
          border-left-width: 3px !important;
          border-left-color: #2563eb !important;
        }
        
        .notes-editor-container .CodeMirror {
          color: #1f2937 !important;
          background: transparent !important;
          height: auto !important;
        }
        
        .notes-editor-container .CodeMirror-lines {
          padding: 16px !important;
        }
        .notes-editor-container .CodeMirror-scroll {
          max-height: none !important;
          overflow-y: auto !important;
        }
        
        .notes-editor-container .CodeMirror .CodeMirror-line {
          line-height: 1.6 !important;
          height: auto !important;
          min-height: 1.6em !important;
          font-size: var(--editor-font-size, 14px) !important;
          font-family: var(--editor-font-family, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace) !important;
          white-space: pre-wrap !important;
          word-wrap: break-word !important;
          word-break: break-all !important;
          overflow-wrap: break-word !important;
        }
        
        .notes-editor-container .CodeMirror .CodeMirror-line span {
          line-height: 1.6 !important;
          vertical-align: baseline !important;
          white-space: pre-wrap !important;
          word-wrap: break-word !important;
          word-break: break-all !important;
          overflow-wrap: break-word !important;
        }
      `}</style>
    </div>
  )
}

export default Editor
