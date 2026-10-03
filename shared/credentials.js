export async function getPasswordVersion(pool) {
  try {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', [
      'password_version',
    ])
    const version = parseInt(result.rows[0]?.value ?? '0', 10)
    return Number.isFinite(version) ? version : 0
  } catch {
    return 0
  }
}

export async function incrementPasswordVersion(pool) {
  const next = (await getPasswordVersion(pool)) + 1
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('password_version', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [String(next)]
  )
  return next
}
