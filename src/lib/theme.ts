import { settingsApi } from '@/lib/api'

export const THEME_IDS = ['mist', 'sakura', 'pine', 'sand', 'black', 'wine'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export interface ThemeOption {
  id: ThemeId
  label: string
  swatch: [string, string, string]
  accent: string
}

export const THEMES: ThemeOption[] = [
  { id: 'mist', label: '雾白', swatch: ['#e5e7eb', '#ffffff', '#2563eb'], accent: '#2563eb' },
  { id: 'sakura', label: '樱粉', swatch: ['#fdf2f8', '#fff1f2', '#be185d'], accent: '#be185d' },
  { id: 'pine', label: '松绿', swatch: ['#d1fae5', '#ecfdf5', '#047857'], accent: '#047857' },
  { id: 'sand', label: '暖沙', swatch: ['#f3e6d4', '#fff7ed', '#b45309'], accent: '#b45309' },
  { id: 'black', label: '暗黑', swatch: ['#0a0a0a', '#171717', '#e5e5e5'], accent: '#e5e5e5' },
  { id: 'wine', label: '酒红', swatch: ['#1c0a0c', '#3f1219', '#e11d48'], accent: '#e11d48' },
]

const LEGACY_THEMES: Record<string, ThemeId> = {
  ink: 'black',
  dusk: 'mist',
}

const THEME_SETTING_KEY = 'theme'

export function resolveTheme(value: unknown): ThemeId {
  if (typeof value === 'string' && value in LEGACY_THEMES) return LEGACY_THEMES[value]
  return THEME_IDS.includes(value as ThemeId) ? (value as ThemeId) : 'mist'
}

export function applyTheme(value: unknown): ThemeId {
  const theme = resolveTheme(value)
  document.documentElement.dataset.theme = theme
  const accent = THEMES.find((item) => item.id === theme)?.accent
  const meta = document.querySelector("meta[name='theme-color']")
  if (accent && meta) meta.setAttribute('content', accent)
  return theme
}

function writeThemeLocal(theme: ThemeId) {
  try {
    const raw = localStorage.getItem('app-settings')
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    localStorage.setItem('app-settings', JSON.stringify({ ...parsed, theme }))
  } catch {
    // ignore
  }
}

export function persistTheme(value: unknown): ThemeId {
  const theme = applyTheme(value)
  writeThemeLocal(theme)
  void settingsApi.save(THEME_SETTING_KEY, theme).catch(() => {
    // offline / unauthorized: local cache still applied
  })
  return theme
}

export async function syncThemeFromServer(): Promise<ThemeId | null> {
  try {
    const response = await settingsApi.get(THEME_SETTING_KEY)
    const data = response.data?.data
    if (data == null) return null
    const theme = resolveTheme(data)
    applyTheme(theme)
    writeThemeLocal(theme)
    return theme
  } catch {
    return null
  }
}
