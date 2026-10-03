export function toBase64(str) {
  try {
    return btoa(str)
  } catch {
    try {
      const bytes = new TextEncoder().encode(str)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      return btoa(binary)
    } catch {
      return ''
    }
  }
}

/**
 * 从 WebDAV 拉取备份文本
 * @returns {Promise<{ text: string, fileName: string } | { error: string, status: number | null }>}
 */
export async function fetchWebDAVBackup({
  baseUrl,
  user,
  pass,
  fileNames = ['notes-latest.md', 'notes.md'],
}) {
  const base = (baseUrl || '').replace(/\/$/, '')
  if (!base || !user || !pass) {
    return { error: 'WebDAV not configured', status: null }
  }

  const auth = 'Basic ' + toBase64(`${user}:${pass}`)
  const headers = {
    Authorization: auth,
    Accept: 'text/plain, text/markdown, application/json',
  }

  let lastStatus = null
  let lastStatusText = ''

  for (const name of fileNames) {
    const url = `${base}/${name}`
    const resp = await fetch(url, { headers, method: 'GET' })
    if (resp.ok) {
      const text = await resp.text()
      return { text, fileName: name }
    }
    lastStatus = resp.status
    try {
      lastStatusText = await resp.text()
    } catch {
      lastStatusText = resp.statusText || ''
    }
  }

  return {
    error: `WebDAV fetch failed: status=${lastStatus}, body=${lastStatusText.slice(0, 200)}`,
    status: lastStatus,
  }
}

/** 上传 Markdown 备份至 WebDAV */
export async function uploadWebDAVBackup({ baseUrl, user, pass, content, fileName = 'notes.md' }) {
  const base = (baseUrl || '').replace(/\/$/, '')
  if (!base || !user || !pass) {
    throw new Error('WebDAV not configured')
  }

  const url = `${base}/${fileName}`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: 'Basic ' + toBase64(`${user}:${pass}`),
      'Content-Type': 'text/markdown; charset=utf-8',
    },
    body: content,
  })

  if (!resp.ok) {
    throw new Error(`WebDAV upload failed: ${resp.status} ${resp.statusText}`)
  }

  return { url, fileName }
}
