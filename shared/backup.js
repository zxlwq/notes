import { normalizeImportNote } from './notes.js'

/** @param {Array<{ title?: string, content?: string, tags?: string[], createdAt?: string, updatedAt?: string }>} notes */
export function formatNotesToMarkdown(notes) {
  return (notes || [])
    .map((n) => {
      if (!n || typeof n !== 'object') return ''
      const title = n.title || '无标题'
      const tags = Array.isArray(n.tags) ? n.tags.join(', ') : ''
      const createdAt = n.createdAt || ''
      const updatedAt = n.updatedAt || ''
      const noteContent = n.content || ''
      return `# ${title}\n标签: ${tags}\n创建时间: ${createdAt}\n更新时间: ${updatedAt}\n\n${noteContent}`
    })
    .filter(Boolean)
    .join('\n\n---\n\n')
}

export function parseMarkdownToNotes(content) {
  if (!content || typeof content !== 'string') return []

  const parts = content
    .split(/\n\n---\n\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const result = []
  for (let i = 0; i < parts.length; i++) {
    const text = parts[i]
    const lines = text.split('\n')

    let title = lines[0] || `导入笔记 ${i + 1}`
    if (title.startsWith('# ')) {
      title = title.slice(2)
    }

    let tags = []
    let createdAt = new Date().toISOString()
    let updatedAt = new Date().toISOString()
    let contentStartIndex = 1

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j]
      if (line.startsWith('标签: ')) {
        const tagStr = line.slice(4).trim()
        tags = tagStr
          ? tagStr
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : []
      } else if (line.startsWith('创建时间: ')) {
        createdAt = line.slice(6).trim() || createdAt
      } else if (line.startsWith('更新时间: ')) {
        updatedAt = line.slice(6).trim() || updatedAt
      } else if (line === '') {
        contentStartIndex = j + 1
        break
      }
    }

    const noteContent = lines.slice(contentStartIndex).join('\n')
    if (!noteContent.trim()) continue

    result.push({
      id: `imported-${Date.now()}-${i}`,
      title,
      content: noteContent,
      tags,
      createdAt,
      updatedAt,
    })
  }
  return result
}

/** JSON 备份或 Markdown 备份 → 笔记数组 */
export function parseBackupToNotes(text) {
  if (!text || typeof text !== 'string') return []

  try {
    const json = JSON.parse(text)
    const arr = Array.isArray(json) ? json : Array.isArray(json?.notes) ? json.notes : null
    if (Array.isArray(arr)) {
      return arr
        .filter((n) => n && (n.content || n.title))
        .map((n, i) =>
          normalizeImportNote({
            ...n,
            id: n.id || `imported-${Date.now()}-${i}`,
          })
        )
    }
  } catch {}

  return parseMarkdownToNotes(text)
}
