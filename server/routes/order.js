import { safeJsonParse } from '../../shared/util.js'

export function registerOrderRoutes(app, ctx) {
  const { pool, authMiddleware, appendLog } = ctx

  app.get('/api/order/:key', authMiddleware, async (req, res) => {
    try {
      const key = req.params.key
      const result = await pool.query('SELECT value FROM order_data WHERE key = $1', [key])

      if (result.rows.length === 0) {
        return res.json({ success: true, data: null })
      }

      const value = result.rows[0].value
      const parsed = value ? safeJsonParse(value, value) : null

      res.json({ success: true, data: parsed })
    } catch (e) {
      console.error('加载顺序失败:', e)
      res.status(500).json({ success: false, error: '加载顺序失败' })
    }
  })

  app.post('/api/order/:key', authMiddleware, async (req, res) => {
    try {
      const key = req.params.key
      const value = req.body

      if (typeof value === 'undefined') {
        return res.status(400).json({ success: false, error: '缺少必需的参数' })
      }

      const valueStr = JSON.stringify(value)

      await pool.query(
        'INSERT INTO order_data (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
        [key, valueStr, new Date().toISOString()]
      )

      await appendLog('info', `Order data saved: ${key}`, { key })
      res.json({ success: true })
    } catch (e) {
      await appendLog('error', '保存顺序失败', { error: String(e) })
      res.status(500).json({ success: false, error: '保存顺序失败' })
    }
  })
}
