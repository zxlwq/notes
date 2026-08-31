import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/Context'
import { authApi } from '@/lib/api'
import { loadAndSetPageTitle } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { AppSettings } from '@/types'

const Login = () => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [displayTitle, setDisplayTitle] = useState('笔记系统')
  const { login, loading: authLoading, needsUnlock } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isUnlockMode =
    needsUnlock || Boolean((location.state as { unlock?: boolean } | null)?.unlock)

  useEffect(() => {
    const username = loadAndSetPageTitle()
    if (username) {
      setDisplayTitle(username)
    }

    const loadSettingsAsync = async () => {
      try {
        const saved = localStorage.getItem('app-settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.username && typeof parsed.username === 'string') {
            setDisplayTitle(parsed.username)
          }
          if (parsed.logoUrl && typeof parsed.logoUrl === 'string') {
            const url = parsed.logoUrl.trim()
            if (url) {
              const img = document.getElementById('login-logo') as HTMLImageElement | null
              if (img) img.src = url
              let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
              if (!link) {
                link = document.createElement('link')
                link.rel = 'icon'
                document.head.appendChild(link)
              }
              link.href = url
            }
          }
        }
      } catch {}
    }

    setTimeout(loadSettingsAsync, 0)

    const settingsHandler = (event: CustomEvent<AppSettings>) => {
      const settings = event.detail
      if (settings && settings.backgroundImageUrl) {
        const bg = settings.backgroundImageUrl.trim()
        if (bg) {
          document.documentElement.style.setProperty('--app-bg-image', `url('${bg}')`)
          const body = document.body
          if (body) {
            body.style.backgroundImage = `url('${bg}')`
            body.style.backgroundSize = 'cover'
            body.style.backgroundPosition = 'center'
            body.style.backgroundRepeat = 'no-repeat'
            body.style.backgroundAttachment = 'fixed'
          }
        } else {
          document.documentElement.style.removeProperty('--app-bg-image')
          const body = document.body
          if (body) {
            body.style.backgroundImage = "url('/background.webp')"
            body.style.backgroundSize = 'cover'
            body.style.backgroundPosition = 'center'
            body.style.backgroundRepeat = 'no-repeat'
            body.style.backgroundAttachment = 'fixed'
          }
        }
      }

      if (settings && settings.username && typeof settings.username === 'string') {
        setDisplayTitle(settings.username)

        document.title = settings.username
        const descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement
        const appMeta = document.querySelector('meta[name="application-name"]') as HTMLMetaElement
        if (descMeta) descMeta.content = `${settings.username} - 个人笔记管理系统`
        if (appMeta) appMeta.content = settings.username
      }

      if (settings && typeof settings.logoUrl === 'string') {
        const url = settings.logoUrl.trim()
        const img = document.getElementById('login-logo') as HTMLImageElement | null
        if (img && url) img.src = url
        if (url) {
          let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
          if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
          }
          link.href = url
        }
      }
    }
    window.addEventListener('settings-changed', settingsHandler as EventListener)

    return () => {
      window.removeEventListener('settings-changed', settingsHandler as EventListener)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const success = await login(password)

      if (success) {
        navigate('/notes')
      } else {
        setError('密码错误')
      }
    } catch {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryCode.trim() || !newPassword.trim()) {
      setError('请输入恢复码和新密码')
      return
    }
    setRecoveryLoading(true)
    setError('')
    try {
      await authApi.resetWithRecovery(recoveryCode.trim(), newPassword)
      setError('')
      setShowRecovery(false)
      setPassword(newPassword)
      setRecoveryCode('')
      setNewPassword('')
      const success = await login(newPassword)
      if (success) navigate('/notes')
    } catch {
      setError('恢复码无效或重置失败')
    } finally {
      setRecoveryLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100/60 to-gray-200/60"
      style={{
        backgroundImage: "var(--app-bg-image, url('/background.webp'))",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="rounded-xl border border-white/40 bg-white/70 p-8 shadow-lg backdrop-blur-md">
          <div className="text-center">
            <div className="flex justify-center">
              <img
                id="login-logo"
                src="/favicon.ico"
                alt="Logo"
                className="login-logo-glow mx-auto size-20 cursor-pointer rounded-full border-2 border-blue-500 object-cover transition-all duration-300 ease-in-out hover:scale-110"
                loading="eager"
                decoding="async"
              />
            </div>
            <h2
              className="mt-4 font-bold text-gray-900"
              style={{ fontSize: 'calc(var(--global-font-size, 16px) * 1.5)' }}
            >
              {isUnlockMode ? '解锁笔记' : displayTitle}
            </h2>
            {isUnlockMode && (
              <p className="mt-2 text-sm text-gray-600">会话仍有效，请输入密码以解密笔记内容</p>
            )}
          </div>

          <form
            className="mt-8 space-y-6"
            onSubmit={handleSubmit}
            data-form="login"
            method="post"
            action="/login"
          >
            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              defaultValue=""
              readOnly
            />
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-5 text-gray-400" />
                  ) : (
                    <Eye className="size-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {error && <div className="text-center text-red-600">{error}</div>}

            <div>
              <Button
                type="submit"
                loading={loading || authLoading}
                className="w-full"
                size="lg"
                data-action="login"
              >
                {isUnlockMode ? '解锁' : '登录'}
              </Button>
            </div>
          </form>

          {!isUnlockMode && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
                onClick={() => {
                  setShowRecovery(!showRecovery)
                  setError('')
                }}
              >
                {showRecovery ? '返回登录' : '忘记密码？使用恢复码'}
              </button>
            </div>
          )}

          {showRecovery && !isUnlockMode && (
            <form
              className="mt-4 space-y-4 border-t border-gray-200 pt-4"
              onSubmit={handleRecovery}
            >
              <p className="text-xs text-gray-500">
                恢复码仅可重置登录密码。若此前未备份加密密钥，已加密笔记将无法解密。
              </p>
              <Input
                type="text"
                placeholder="恢复码（XXXX-XXXX-XXXX-XXXX）"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Button type="submit" loading={recoveryLoading} className="w-full">
                重置密码
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
