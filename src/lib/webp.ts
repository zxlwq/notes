export function loadAndApplyBackground(
  imageUrl: string | null | undefined,
  onSuccess?: () => void,
  onError?: () => void
) {
  const bg = imageUrl?.trim()

  if (!bg) {
    document.documentElement.style.removeProperty('--app-bg-image')
    onSuccess?.()
    return
  }

  document.documentElement.style.setProperty('--app-bg-image', `url('${bg}')`)

  const body = document.body
  if (body) {
    body.style.backgroundImage = `url('${bg}')`
    body.style.backgroundSize = 'cover'
    body.style.backgroundPosition = 'center'
    body.style.backgroundRepeat = 'no-repeat'
    body.style.backgroundAttachment = 'fixed'
  }

  const img = new Image()

  img.onload = () => {
    onSuccess?.()
  }

  img.onerror = () => {
    console.error('背景图验证失败:', bg.substring(0, 50) + '...')
    onError?.()
  }

  img.src = bg
}

export function applyBackgroundFromSettings(onSuccess?: () => void, onError?: () => void) {
  try {
    const saved = localStorage.getItem('app-settings')
    if (!saved) {
      onSuccess?.()
      return
    }

    const parsed = JSON.parse(saved)
    loadAndApplyBackground(parsed.backgroundImageUrl, onSuccess, onError)
  } catch (error) {
    console.error('Failed to apply background from settings:', error)
    onError?.()
  }
}

export function preloadBackground(imageUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = imageUrl
  })
}
