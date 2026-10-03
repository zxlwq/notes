export function safeJsonParse(str, defaultValue = null) {
  if (!str || typeof str !== 'string') return defaultValue
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}

export function toIsoString(value) {
  if (!value) return new Date().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      return value.replace(' ', 'T') + 'Z'
    }
    return value
  }
  return new Date().toISOString()
}
