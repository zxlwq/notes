import { getRequestIp } from '../../shared/rateLimit.js'
import { getAiStatus, handleAiComplete } from '../../shared/ai/handlers.js'

export function registerAiRoutes(app, ctx) {
  const { authMiddleware, appendLog, cleanIP } = ctx

  app.get('/api/ai/status', authMiddleware, (req, res) => {
    res.json(getAiStatus(process.env))
  })

  app.post('/api/ai/complete', authMiddleware, async (req, res) => {
    const ip = cleanIP(getRequestIp(req))
    const result = await handleAiComplete(process.env, req.body, ip, appendLog)

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value)
      }
    }

    res.status(result.status).json(result.body)
  })
}
