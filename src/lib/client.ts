import axios, { AxiosError, AxiosResponse } from 'axios'
import { getSessionToken, clearSessionToken } from '@/lib/session'

interface ImportMetaEnv {
  VITE_API_BASE?: string
}

export const api = axios.create({
  baseURL: (import.meta as { env?: ImportMetaEnv }).env?.VITE_API_BASE || '',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = getSessionToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response: AxiosResponse) => {
    const contentType = String(response.headers?.['content-type'] ?? '')
    const isJson = contentType.includes('application/json')
    const data = response.data
    const looksLikeHtml =
      typeof data === 'string' && data.trim().toLowerCase().startsWith('<!doctype html')
    if (!isJson && looksLikeHtml) {
      const error = new Error(
        '服务返回了 HTML，而不是 JSON。请检查 API 代理或部署路径。'
      ) as AxiosError
      error.response = response
      throw error
    }
    return response
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearSessionToken()
      const path = window.location.pathname
      if (path !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
