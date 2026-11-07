import { pool, GIT_TOKEN } from '../context.js'
import {
  createOrUpdateGist as createOrUpdateGistCore,
  fetchGist as fetchGistCore,
} from '../../shared/gist.js'
import { createPgGistStore } from '../../shared/gist-store.js'

const store = createPgGistStore(pool)

export { findLatestNotesGist, getGistNotesContent } from '../../shared/gist.js'

export function getGistId() {
  return store.getGistId()
}

export function saveGistId(gistId) {
  return store.saveGistId(gistId)
}

export function createOrUpdateGist(content) {
  return createOrUpdateGistCore(GIT_TOKEN, content, store)
}

export function getGist() {
  return fetchGistCore(GIT_TOKEN, store)
}
