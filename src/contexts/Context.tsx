import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '@/lib/api'
import { setEncryptionPassword, clearEncryptionPassword, hasEncryptionPassword } from '@/lib/crypto'
import { lockSettingsFromDetail, readLockSettings } from '@/lib/lock'
import { setSessionToken, clearSessionToken, getSessionToken } from '@/lib/session'
import { clearSearchCache } from '@/lib/search'
import { clearOfflineStore } from '@/lib/offline'
import type { AppSettings } from '@/types'

interface AuthContextType {
  isAuthenticated: boolean
  isUnlocked: boolean
  login: (password: string) => Promise<boolean>
  logout: () => Promise<void>
  loading: boolean
  needsUnlock: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components -- hook exported alongside provider
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(hasEncryptionPassword())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi
      .getSession()
      .then((res) => {
        const authed = Boolean(res.data.authenticated)
        setIsAuthenticated(authed)
        if (!authed) clearSessionToken()
        setIsUnlocked(hasEncryptionPassword())
      })
      .catch(() => {
        // 网络抖动时若本地仍有 JWT，保留会话并进入「解锁」而非完全登出
        setIsAuthenticated(Boolean(getSessionToken()))
        setIsUnlocked(hasEncryptionPassword())
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !isUnlocked) return

    let lastActivity = Date.now()
    let lockConfig = readLockSettings()

    const lock = () => {
      clearEncryptionPassword()
      setIsUnlocked(false)
    }

    const shouldLock = () => {
      if (!lockConfig.autoLock) return false
      return Date.now() - lastActivity >= lockConfig.timeoutMs
    }

    const touch = () => {
      lastActivity = Date.now()
    }

    const tick = () => {
      if (shouldLock()) lock()
    }

    const onSettings = (event: Event) => {
      const detail = (event as CustomEvent<Partial<AppSettings>>).detail
      lockConfig = detail ? lockSettingsFromDetail(detail) : readLockSettings()
      if (shouldLock()) lock()
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('settings-changed', onSettings)
    const interval = window.setInterval(tick, 30_000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('settings-changed', onSettings)
      window.clearInterval(interval)
    }
  }, [isAuthenticated, isUnlocked])

  const login = async (passwordInput: string): Promise<boolean> => {
    try {
      const response = await authApi.login({ password: passwordInput })

      if (response.data.success) {
        if (response.data.token) {
          setSessionToken(response.data.token)
        }
        setEncryptionPassword(passwordInput)
        setIsAuthenticated(true)
        setIsUnlocked(true)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    clearSessionToken()
    clearEncryptionPassword()
    void clearSearchCache()
    void clearOfflineStore()
    setIsAuthenticated(false)
    setIsUnlocked(false)
  }

  const value: AuthContextType = {
    isAuthenticated: isAuthenticated && isUnlocked,
    isUnlocked,
    login,
    logout,
    loading,
    needsUnlock: isAuthenticated && !isUnlocked,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
