export async function getPasswordVersion(sql) {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'password_version'`
    const version = parseInt(rows[0]?.value ?? '0', 10)
    return Number.isFinite(version) ? version : 0
  } catch {
    return 0
  }
}

export async function incrementPasswordVersion(sql) {
  const next = (await getPasswordVersion(sql)) + 1
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES ('password_version', ${String(next)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `
  return next
}

export async function getEffectivePassword(sql, envPassword) {
  try {
    const rows = await sql`
      SELECT key, value FROM settings WHERE key IN ('password', 'password_set')
    `
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    if (map.password_set === 'true' && map.password) {
      return map.password
    }
  } catch {
    // fall through
  }
  return envPassword || ''
}
