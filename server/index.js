import express from 'express'
import path from 'path'
import { existsSync } from 'fs'
import serveStatic from 'serve-static'
import * as ctx from './context.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerNotesRoutes } from './routes/notes.js'
import { registerBackupRoutes } from './routes/backup.js'
import { registerGistRoutes } from './routes/gist.js'
import { registerR2Routes } from './routes/r2.js'
import { registerOrderRoutes } from './routes/order.js'
import { registerLogsRoutes } from './routes/logs.js'
import { registerAiRoutes } from './routes/ai.js'
import { setExpressCorsHeaders } from '../shared/cors.js'
import { SECURITY_HEADERS } from '../shared/security-headers.js'

const app = express()

app.set('trust proxy', true)

if (ctx.isProduction) {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next()
    return res.redirect(301, `https://${req.headers.host}${req.url}`)
  })
}

app.use((req, res, next) => {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value)
  }
  next()
})

app.use((req, res, next) => {
  setExpressCorsHeaders(req, res)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

registerAuthRoutes(app, ctx)
registerNotesRoutes(app, ctx)
registerBackupRoutes(app, ctx)
registerGistRoutes(app, ctx)
registerR2Routes(app, ctx)
registerOrderRoutes(app, ctx)
registerLogsRoutes(app, ctx)
registerAiRoutes(app, ctx)

app.use((err, req, res, _next) => {
  console.error('[服务器] 未处理的错误:', err)
  res.status(500).json({ success: false, error: '服务器内部错误' })
})

if (existsSync(ctx.distDir)) {
  app.use(
    serveStatic(ctx.distDir, {
      index: false,
      maxAge: '1y',
      setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=31536000'),
    })
  )

  app.get('*', (req, res) => {
    res.sendFile(path.join(ctx.distDir, 'index.html'))
  })
} else {
  console.warn(`[服务器] 警告: 静态文件目录不存在: ${ctx.distDir}`)
  app.get('*', (req, res) => {
    res.status(503).json({ success: false, error: '静态文件目录未找到，请先构建前端应用' })
  })
}

async function startServer() {
  try {
    await ctx.initDatabase()

    try {
      await ctx.pool.query('SELECT 1')
      console.warn('[服务器] PostgreSQL 连接成功')
    } catch (dbError) {
      console.error('[服务器] PostgreSQL 连接失败:', dbError)
      throw dbError
    }

    const startTime = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    app.listen(ctx.PORT, () => {
      console.warn('\n=================================')
      console.warn(`= 应用启动时间: ${startTime} =`)
      console.warn('=================================\n')
      console.warn(`[服务器] 正在监听 http://0.0.0.0:${ctx.PORT}`)
      console.warn(`[服务器] 发布目录: ${ctx.distDir}`)
      ctx.appendLog('info', '服务器已启动', `端口: ${ctx.PORT}, 数据库 已连接`).catch((err) => {
        console.error('记录启动日志失败:', err)
      })
    })
  } catch (e) {
    console.error('[服务器] 启动失败:', e)
    process.exit(1)
  }
}

startServer()
