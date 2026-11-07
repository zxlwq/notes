import { THEMES, type ThemeId } from '@/lib/theme'

interface ThemePickerProps {
  value: ThemeId
  onChange: (theme: ThemeId) => void
}

export default function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <span id="settings-theme-label" className="font-medium text-gray-700">
        主题
      </span>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-labelledby="settings-theme-label"
      >
        {THEMES.map((theme) => {
          const selected = value === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(theme.id)}
              className="flex min-w-[5.5rem] items-center gap-2 rounded-md border px-2 py-1.5 text-left"
              style={{
                borderColor: selected ? theme.accent : 'var(--theme-field-border, #d1d5db)',
                boxShadow: selected ? `0 0 0 1px ${theme.accent}` : undefined,
                background: 'var(--theme-field, #fff)',
                color: 'var(--theme-text, #111827)',
              }}
            >
              <span className="flex shrink-0 overflow-hidden rounded-sm" aria-hidden>
                {theme.swatch.map((color) => (
                  <span key={color} className="h-4 w-2" style={{ background: color }} />
                ))}
              </span>
              {theme.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
