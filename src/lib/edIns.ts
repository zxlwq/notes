/* eslint-disable no-unused-vars -- type-only parameters */
import type { MouseEvent } from 'react'

export type MarkdownInserter = (before: string, after: string) => void

let inserter: MarkdownInserter | null = null

export function setMarkdownInserter(fn: MarkdownInserter | null) {
  inserter = fn
}

export function insertMarkdown(before: string, after: string) {
  if (!inserter) {
    console.warn('[toolbar] 编辑器尚未就绪，无法插入 Markdown')
    return
  }
  inserter(before, after)
}

interface CodeMirrorLike {
  getSelection: () => string
  getValue: () => string
  getCursor: (which?: 'from' | 'to' | 'anchor' | 'head') => { line: number; ch: number }
  getDoc: () => {
    indexFromPos: (pos: { line: number; ch: number }) => number
  }
  replaceSelection: (text: string) => void
  focus: () => void
}

function getCodeMirror(): CodeMirrorLike | null {
  const el = document.querySelector('.notes-editor-container .CodeMirror') as
    | (HTMLElement & { CodeMirror?: CodeMirrorLike })
    | null
  return el?.CodeMirror ?? null
}

export function getEditorSelection(): string {
  return getCodeMirror()?.getSelection() ?? ''
}

export function hasEditorSelection(): boolean {
  return getEditorSelection().length > 0
}

export function getEditorContentForAi(): { content: string; hasSelection: boolean } {
  const cm = getCodeMirror()
  if (!cm) return { content: '', hasSelection: false }
  const selection = cm.getSelection()
  if (selection) return { content: selection, hasSelection: true }
  return { content: cm.getValue(), hasSelection: false }
}

export function getEditorContextBeforeCursor(maxChars = 4000): string {
  const cm = getCodeMirror()
  if (!cm) return ''
  const doc = cm.getDoc()
  const cursor = cm.getCursor()
  const headIndex = doc.indexFromPos(cursor)
  const full = cm.getValue()
  const before = full.slice(0, headIndex)
  return before.length > maxChars ? before.slice(-maxChars) : before
}

export function insertEditorText(text: string): void {
  const cm = getCodeMirror()
  if (!cm) return
  cm.replaceSelection(text)
  cm.focus()
}

export function replaceEditorSelection(text: string): void {
  insertEditorText(text)
}

/** 供 Toolbar 使用：保持 CodeMirror 焦点并在当前光标处插入 */
export function toolbarInsert(e: MouseEvent, before: string, after: string) {
  e.preventDefault()
  const cmEl = document.querySelector('.notes-editor-container .CodeMirror') as
    | (HTMLElement & { CodeMirror?: { focus: () => void } })
    | null
  cmEl?.CodeMirror?.focus()
  insertMarkdown(before, after)
}
