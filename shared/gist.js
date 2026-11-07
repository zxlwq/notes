function githubHeaders(gitToken, json = false) {
  return {
    Authorization: `Bearer ${gitToken}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Notes-App',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function readGitHubError(resp, fallback) {
  const errorText = await resp.text()
  try {
    const errorJson = JSON.parse(errorText)
    return errorJson.message || errorJson.error || fallback
  } catch {
    return errorText.slice(0, 200) || fallback
  }
}

export async function findLatestNotesGist(gitToken) {
  try {
    const resp = await fetch('https://api.github.com/gists', {
      headers: githubHeaders(gitToken),
    })
    if (!resp.ok) {
      console.error(`[GIST] 获取 Gist 列表失败: ${resp.status}`)
      return null
    }
    const gists = await resp.json()
    const notesGists = (gists || [])
      .filter((gist) => {
        const hasNotesFile = gist.files && 'notes.md' in gist.files
        const hasNotesDescription = gist.description && gist.description.includes('笔记备份')
        return hasNotesFile && hasNotesDescription
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    if (notesGists.length > 0) {
      return { id: notesGists[0].id, updated_at: notesGists[0].updated_at }
    }
    return null
  } catch (e) {
    console.error('[GIST] 搜索 Gist 失败:', e)
    return null
  }
}

export function buildGistPayload(content) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return {
    description: '笔记备份 - ' + now.toISOString().replace('T', ' ').substring(0, 19),
    public: false,
    files: { 'notes.md': { content } },
  }
}

async function patchGist(gitToken, gistId, gistData) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: githubHeaders(gitToken, true),
    body: JSON.stringify(gistData),
  })
  if (!resp.ok) {
    throw Object.assign(new Error(await readGitHubError(resp, `GitHub API 错误: ${resp.status}`)), {
      status: resp.status,
    })
  }
  return resp.json()
}

async function createGist(gitToken, gistData) {
  const resp = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: githubHeaders(gitToken, true),
    body: JSON.stringify(gistData),
  })
  if (!resp.ok) {
    throw new Error(await readGitHubError(resp, `GitHub API 错误: ${resp.status}`))
  }
  return resp.json()
}

async function getGistById(gitToken, gistId) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: githubHeaders(gitToken),
  })
  if (!resp.ok) {
    throw Object.assign(new Error(await readGitHubError(resp, `GitHub API 错误: ${resp.status}`)), {
      status: resp.status,
    })
  }
  return resp.json()
}

async function resolveGistId(gitToken, store) {
  let gistId = await store.getGistId()
  if (gistId) return gistId
  const latest = await findLatestNotesGist(gitToken)
  if (!latest) return null
  gistId = latest.id
  await store.saveGistId(gistId)
  return gistId
}

/** @param {{ getGistId: () => Promise<string|null>, saveGistId: (id: string) => Promise<void>, clearGistId: () => Promise<void> }} store */
export async function createOrUpdateGist(gitToken, content, store) {
  if (!gitToken) throw new Error('GitHub Token 未配置')

  const gistData = buildGistPayload(content)
  let gistId = await resolveGistId(gitToken, store)

  if (gistId) {
    try {
      return await patchGist(gitToken, gistId, gistData)
    } catch (error) {
      if (!(error && typeof error === 'object' && 'status' in error && error.status === 404))
        throw error
      console.warn(`[GIST] Gist ${gistId} 不存在，清除无效 ID 并搜索...`)
      await store.clearGistId()
      gistId = await resolveGistId(gitToken, store)
      if (gistId) {
        try {
          return await patchGist(gitToken, gistId, gistData)
        } catch (retryError) {
          if (
            !(
              retryError &&
              typeof retryError === 'object' &&
              'status' in retryError &&
              retryError.status === 404
            )
          ) {
            throw retryError
          }
        }
      }
    }
  }

  console.warn('[GIST] 创建新的 Gist...')
  const created = await createGist(gitToken, gistData)
  if (created?.id) {
    await store.saveGistId(created.id)
    console.warn(`[GIST] 创建新 Gist 成功: ${created.id}`)
  }
  return created
}

/** @param {{ getGistId: () => Promise<string|null>, saveGistId: (id: string) => Promise<void>, clearGistId: () => Promise<void> }} store */
export async function fetchGist(gitToken, store) {
  if (!gitToken) throw new Error('GitHub Token 未配置')

  let gistId = await resolveGistId(gitToken, store)
  if (!gistId) throw new Error('未找到Gist ID，请先上传备份')

  try {
    return await getGistById(gitToken, gistId)
  } catch (error) {
    if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) {
      throw error instanceof Error ? error : new Error('GitHub Gist 下载失败')
    }
    console.warn(`[GIST] Gist ${gistId} 不存在，搜索所有 Gist...`)
    await store.clearGistId()
    gistId = await resolveGistId(gitToken, store)
    if (!gistId) throw new Error('未找到Gist ID，请先上传备份')
    return getGistById(gitToken, gistId)
  }
}

export function getGistNotesContent(gistData) {
  const file = gistData?.files?.['notes.md'] || Object.values(gistData?.files || {})[0]
  return file?.content ?? null
}
