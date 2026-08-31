/* eslint-disable no-unused-vars -- callback type parameters */
type ReloadFn = (reloadPage?: boolean) => Promise<void>

let reloadFn: ReloadFn | undefined
let pendingListener: ((pending: boolean) => void) | null = null

export function onSwPending(listener: (pending: boolean) => void): () => void {
  pendingListener = listener
  return () => {
    if (pendingListener === listener) pendingListener = null
  }
}

export function notifySwPending(reload: ReloadFn) {
  reloadFn = reload
  pendingListener?.(true)
}

export function applySwUpdate() {
  pendingListener?.(false)
  return reloadFn?.(true)
}

export function dismissSwUpdate() {
  pendingListener?.(false)
}
