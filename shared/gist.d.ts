export function findLatestNotesGist(
  gitToken: string
): Promise<{ id: string; updated_at: string } | null>

export function buildGistPayload(content: string): {
  description: string
  public: boolean
  files: Record<string, { content: string }>
}

export interface GistStore {
  getGistId(): Promise<string | null>
  saveGistId(id: string): Promise<void>
  clearGistId(): Promise<void>
}

export function createOrUpdateGist(
  gitToken: string,
  content: string,
  store: GistStore
): Promise<{ id?: string }>

export function fetchGist(
  gitToken: string,
  store: GistStore
): Promise<{ files: Record<string, { content?: string }> }>

export function getGistNotesContent(gistData: {
  files?: Record<string, { content?: string }>
}): string | null
