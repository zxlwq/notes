;(function () {
  var themes = {
    mist: 'mist',
    sakura: 'sakura',
    pine: 'pine',
    sand: 'sand',
    black: 'black',
    wine: 'wine',
    ink: 'black',
    dusk: 'mist',
  }
  var ready = false
  var hasLocalTheme = false

  function resolveTheme(value) {
    return themes[value] || 'mist'
  }

  function markReady() {
    if (ready) return
    ready = true
    document.documentElement.setAttribute('data-theme-ready', '1')
  }

  function applyTheme(themeId) {
    var theme = resolveTheme(themeId)
    document.documentElement.dataset.theme = theme

    document.querySelectorAll('link[data-bg-preload]').forEach(function (el) {
      el.remove()
    })

    if (theme !== 'mist') {
      document.documentElement.style.removeProperty('--app-bg-image')
      return
    }

    var bg = ''
    try {
      var saved = localStorage.getItem('app-settings')
      var parsed = saved ? JSON.parse(saved) : {}
      bg = typeof parsed.backgroundImageUrl === 'string' ? parsed.backgroundImageUrl.trim() : ''
      if (bg) {
        document.documentElement.style.setProperty('--app-bg-image', "url('" + bg + "')")
      } else {
        document.documentElement.style.removeProperty('--app-bg-image')
      }
    } catch {}

    var link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = bg || '/background.webp'
    link.setAttribute('data-bg-preload', '1')
    document.head.appendChild(link)
  }

  function writeThemeLocal(themeId) {
    try {
      var theme = resolveTheme(themeId)
      var raw = localStorage.getItem('app-settings')
      var parsed = raw ? JSON.parse(raw) : {}
      parsed.theme = theme
      localStorage.setItem('app-settings', JSON.stringify(parsed))
    } catch {}
  }

  try {
    var saved = localStorage.getItem('app-settings')
    var parsed = saved ? JSON.parse(saved) : {}
    if (parsed.theme != null && parsed.theme !== '') {
      hasLocalTheme = true
      applyTheme(parsed.theme)
      markReady()
    }

    var logo = typeof parsed.logoUrl === 'string' ? parsed.logoUrl.trim() : ''
    if (logo) {
      var icon = document.querySelector("link[rel='icon']")
      if (!icon) {
        icon = document.createElement('link')
        icon.rel = 'icon'
        icon.type = 'image/x-icon'
        document.head.appendChild(icon)
      }
      icon.href = logo
    }

    var fontSizeMap = { 小: '14px', 中: '16px', 大: '18px', 特大: '20px', 超大: '22px' }
    if (parsed.fontSize && fontSizeMap[parsed.fontSize]) {
      document.documentElement.style.setProperty('--global-font-size', fontSizeMap[parsed.fontSize])
      document.documentElement.style.setProperty('--editor-font-size', fontSizeMap[parsed.fontSize])
    }

    if (parsed.username && typeof parsed.username === 'string') {
      document.title = parsed.username
    }
  } catch {}

  var fallbackTimer = setTimeout(function () {
    if (!document.documentElement.dataset.theme) applyTheme('mist')
    markReady()
  }, 800)

  fetch('/api/settings/theme', { credentials: 'same-origin' })
    .then(function (res) {
      return res.ok ? res.json() : null
    })
    .then(function (body) {
      clearTimeout(fallbackTimer)
      if (body && body.success && body.data != null) {
        applyTheme(body.data)
        writeThemeLocal(body.data)
      } else if (!hasLocalTheme) {
        applyTheme('mist')
      }
      markReady()
    })
    .catch(function () {
      clearTimeout(fallbackTimer)
      if (!hasLocalTheme) applyTheme('mist')
      markReady()
    })
})()
