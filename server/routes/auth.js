import rateLimit from 'express-rate-limit'
import {
  signSessionToken,
  verifySessionToken,
  buildSessionCookie,
  clearSessionCookie,
  extractSessionToken,
  getJwtSecret,
  getSessionTtlSec,
  hashRecoveryCode,
  generateRecoveryCode,
} from '../../shared/session.js'
import {
  verifyPassword,
  hashPassword,
  rehashLegacyPassword,
  savePasswordHash,
} from '../../shared/password.js'
import { getPasswordVersion, incrementPasswordVersion } from '../../shared/credentials.js'

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
})

export function registerAuthRoutes(app, ctx) {
  const { pool, PASSWORD, isProduction, authMiddleware, getEffectivePassword, appendLog, cleanIP } =
    ctx

  app.get('/api/password/status', authMiddleware, async (req, res) => {
    try {
      const hasEnvPassword = Boolean(PASSWORD)

      const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['password'])
      const hasDbPassword = result.rows.length > 0 && result.rows[0].value

      res.json({
        success: true,
        usingD1: false,
        usingPostgreSQL: true,
        hasEnvPassword,
        hasDbPassword,
        passwordSource: hasEnvPassword ? 'env' : hasDbPassword ? 'postgresql' : 'none',
      })
    } catch (e) {
      console.error('密码状态错误', e)
      res.status(500).json({ success: false, error: '服务器内部错误' })
    }
  })

  app.get('/api/test-logs', authMiddleware, async (req, res) => {
    try {
      await appendLog('info', '测试日志条目', `时间: ${Date.now()}`)

      const result = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 5')
      const logs = result.rows

      res.json({
        success: true,
        postgresConnected: true,
        logsCount: logs.length,
        latestLog: logs[0] || null,
      })
    } catch (e) {
      res.json({
        success: false,
        postgresConnected: false,
        error: String(e),
      })
    }
  })

  app.get('/api/session', async (req, res) => {
    const secret = getJwtSecret(PASSWORD)
    const pwdVer = await getPasswordVersion(pool)
    const token = extractSessionToken(req)
    const authenticated = Boolean(
      token && secret && verifySessionToken(token, secret, { expectedPwdVer: pwdVer })
    )
    res.json({ authenticated })
  })

  app.post('/api/logout', (req, res) => {
    res.setHeader('Set-Cookie', clearSessionCookie(isProduction))
    res.json({ success: true })
  })

  app.post('/api/login', authRateLimit, async (req, res) => {
    const { password } = req.body || {}
    const storedCredential = await getEffectivePassword()
    if (await verifyPassword(password, storedCredential)) {
      await rehashLegacyPassword(pool, password, storedCredential)
      const pwdVer = await getPasswordVersion(pool)
      const secret = getJwtSecret(PASSWORD)
      if (!secret) {
        return res.status(500).json({ success: false, error: 'JWT 未配置' })
      }
      await appendLog('info', '用户登录成功', `IP: ${cleanIP(req.ip)}`)
      const ttlSec = getSessionTtlSec()
      const token = signSessionToken(secret, { pwdVer, ttlSec })
      res.setHeader('Set-Cookie', buildSessionCookie(token, isProduction, ttlSec))
      return res.json({ success: true, token })
    }
    await appendLog('warn', '用户登录失败', `IP: ${cleanIP(req.ip)}, 原因: 密码错误`)
    res.status(401).json({ success: false, error: '密码无效' })
  })

  app.post('/api/password', authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {}
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: '缺少密码参数' })
      }
      const storedCredential = await getEffectivePassword()
      if (!(await verifyPassword(currentPassword, storedCredential))) {
        return res.status(401).json({ success: false, error: '当前密码错误' })
      }
      const hash = await hashPassword(newPassword)
      await savePasswordHash(pool, hash)
      await incrementPasswordVersion(pool)
      await appendLog('info', '密码修改成功', `IP: ${cleanIP(req.ip)}`)
      res.json({ success: true })
    } catch (e) {
      console.error('修改密码失败:', e)
      res.status(500).json({ success: false, error: '服务器内部错误' })
    }
  })

  app.get('/api/recovery/status', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query('SELECT value FROM settings WHERE key = $1', [
        'recovery_hash',
      ])
      res.json({ configured: result.rows.length > 0 && Boolean(result.rows[0].value) })
    } catch (_e) {
      res.status(500).json({ success: false, error: '服务器内部错误' })
    }
  })

  app.post('/api/recovery/setup', authMiddleware, async (req, res) => {
    try {
      const code = generateRecoveryCode()
      const hash = hashRecoveryCode(code)
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('recovery_hash', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [hash]
      )
      await appendLog('info', '恢复码已生成', `IP: ${cleanIP(req.ip)}`)
      res.json({ success: true, recoveryCode: code })
    } catch (_e) {
      res.status(500).json({ success: false, error: '服务器内部错误' })
    }
  })

  app.post('/api/recovery/reset', authRateLimit, async (req, res) => {
    try {
      const { recoveryCode, newPassword } = req.body || {}
      if (!recoveryCode || !newPassword) {
        return res.status(400).json({ success: false, error: '缺少参数' })
      }
      const result = await pool.query('SELECT value FROM settings WHERE key = $1', [
        'recovery_hash',
      ])
      const storedHash = result.rows[0]?.value
      if (!storedHash || hashRecoveryCode(recoveryCode) !== storedHash) {
        return res.status(401).json({ success: false, error: '恢复码无效' })
      }
      const hash = await hashPassword(newPassword)
      await savePasswordHash(pool, hash)
      await incrementPasswordVersion(pool)
      await appendLog('info', '通过恢复码重置密码', `IP: ${cleanIP(req.ip)}`)
      res.json({ success: true })
    } catch (_e) {
      res.status(500).json({ success: false, error: '服务器内部错误' })
    }
  })
}
