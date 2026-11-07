declare global {
  interface Window {
    addEventListener(
      type: 'settings-changed',
      listener: (event: CustomEvent<Partial<import('./types').AppSettings>>) => void,
      options?: boolean | AddEventListenerOptions
    ): void
    addEventListener(
      type: 'notes-imported',
      listener: (
        event: CustomEvent<{ count: number; format: import('./types').ImportFormat }>
      ) => void,
      options?: boolean | AddEventListenerOptions
    ): void
    addEventListener(
      type: 'note-created',
      listener: (event: CustomEvent<import('./types').Note>) => void,
      options?: boolean | AddEventListenerOptions
    ): void
    addEventListener(
      type: 'note-updated',
      listener: (event: CustomEvent<import('./types').Note>) => void,
      options?: boolean | AddEventListenerOptions
    ): void
    addEventListener(
      type: 'note-deleted',
      listener: (event: CustomEvent<{ id: string; title: string }>) => void,
      options?: boolean | AddEventListenerOptions
    ): void
  }
}

export {}
