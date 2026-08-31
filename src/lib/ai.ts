import axios from 'axios'
import { api } from '@/lib/api'
import { getSessionToken } from '@/lib/session'

export type AiAction =
  | 'summarize'
  | 'suggest'
  | 'polish'
  | 'expand'
  | 'continue'
  | 'tags'
  | 'custom'

export interface AiLimits {
  maxInputChars: number
  rateLimitMax: number
  rateLimitWindowSec: number
}

export interface AiProviderStatus {
  id: string
  model: string
  models: string[]
  cfMode?: 'binding' | 'rest'
}

export interface AiStatus {
  enabled: boolean
  provider: string | null
  model: string | null
  models: string[]
  providers: AiProviderStatus[]
  cfMode?: 'binding' | 'rest'
  limits: AiLimits
}

export interface AiCompleteRequest {
  action: AiAction
  title?: string
  content: string
  instruction?: string
  locale?: string
  provider?: string
  model?: string
}

export interface AiCompleteResponse {
  success: boolean
  text?: string
  error?: string
  truncated?: boolean
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

const aiClient = axios.create({
  baseURL: api.defaults.baseURL,
  timeout: 60000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

aiClient.interceptors.request.use((config) => {
  const token = getSessionToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const aiApi = {
  async getStatus(): Promise<AiStatus> {
    const res = await api.get<AiStatus>('/api/ai/status')
    return res.data
  },

  async complete(payload: AiCompleteRequest, signal?: AbortSignal): Promise<AiCompleteResponse> {
    const res = await aiClient.post<AiCompleteResponse>('/api/ai/complete', payload, { signal })
    return res.data
  },
}

export function parseTagSuggestions(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    }
  } catch {
    // fall through
  }

  return trimmed
    .split(/[,，、\n]/)
    .map((t) => t.trim().replace(/^["'[\]]+|["'[\]]+$/g, ''))
    .filter(Boolean)
}

export const AI_PRIVACY_ACK_KEY = 'ai_privacy_ack'

export function hasAiPrivacyAck(): boolean {
  return localStorage.getItem(AI_PRIVACY_ACK_KEY) === '1'
}

export function setAiPrivacyAck(): void {
  localStorage.setItem(AI_PRIVACY_ACK_KEY, '1')
}

export const AI_MODEL_KEY = 'ai_selected_model'
export const AI_PROVIDER_KEY = 'ai_selected_provider'

export const AI_PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  ark: '火山方舟',
  kilo: 'Kilo',
  cf: 'Cloudflare',
  zhipu: '智谱',
  gh: 'GitHub',
}

export function getAiProviderLabel(id: string): string {
  return AI_PROVIDER_LABELS[id] ?? id
}

export function getStoredAiModel(provider: string | null): string | null {
  if (!provider) return null
  try {
    const raw = localStorage.getItem(AI_MODEL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed[provider] === 'string' ? parsed[provider] : null
  } catch {
    return null
  }
}

export function setStoredAiModel(provider: string, model: string): void {
  try {
    const raw = localStorage.getItem(AI_MODEL_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    parsed[provider] = model
    localStorage.setItem(AI_MODEL_KEY, JSON.stringify(parsed))
  } catch {
    // ignore
  }
}

export function getStoredAiProvider(): string | null {
  try {
    const raw = localStorage.getItem(AI_PROVIDER_KEY)
    return raw && raw.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

export function setStoredAiProvider(provider: string): void {
  try {
    localStorage.setItem(AI_PROVIDER_KEY, provider)
  } catch {
    // ignore
  }
}
