;(function () {
  try {
    const saved = localStorage.getItem('app-settings')
    if (!saved) return
    const parsed = JSON.parse(saved)

    const bg = parsed.backgroundImageUrl?.trim()
    if (bg) {
      document.documentElement.style.setProperty('--app-bg-image', `url('${bg}')`)
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = bg
      document.head.appendChild(link)
    }

    const logo = parsed.logoUrl?.trim()
    if (logo) {
      let link = document.querySelector("link[rel='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        link.type = 'image/x-icon'
        document.head.appendChild(link)
      }
      link.href = logo
    }

    if (parsed.username && typeof parsed.username === 'string') {
      document.title = parsed.username
    }
  } catch {}
})()
