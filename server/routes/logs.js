export function registerLogsRoutes(app, ctx) {
  const { pool, authMiddleware } = ctx

  app.get('/api/logs', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 200')
      const logs = result.rows.map((row) => ({
        id: row.id,
        level: row.level,
        message: row.message,
        meta: row.meta,
        created_at: row.created_at?.toISOString() || new Date().toISOString(),
      }))

      res.json({ items: logs })
    } catch (e) {
      console.error('加载日志失败:', e)
      res.status(500).json({ success: false, error: '加载日志失败' })
    }
  })

  app.delete('/api/logs', authMiddleware, async (req, res) => {
    try {
      await pool.query('DELETE FROM logs')
      res.json({ success: true })
    } catch {
      res.status(500).json({ success: false, error: '清空日志失败' })
    }
  })
}
