import { createRateLimiter } from '../rateLimit.js'
import { pickProviderModel } from './models.js'
import {
  listConfiguredProviders,
  resolveProvider,
  resolveProviderById,
  toProviderStatus,
} from './providers.js'
import { getAiLimits } from './config.js'
import { validateCompleteRequest } from './validate.js'
import { completeAi } from './complete.js'

/** @typedef {import('./providers.js').ResolveProviderOptions} ResolveProviderOptions */

/** @type {import('../rateLimit.js').createRateLimiter extends (...args: infer A) => infer R ? R : never | null} */
let aiLimiter = null
/** @type {string | null} */
let aiLimiterKey = null

/**
 * @param {string} ip
 * @param {Record<string, unknown>} env
 */
export function checkAiRateLimit(ip, env) {
  const limits = getAiLimits(env)
  const key = `${limits.rateLimitMax}:${limits.rateLimitWindowSec}`
  if (!aiLimiter || aiLimiterKey !== key) {
    aiLimiter = createRateLimiter({
      windowMs: limits.rateLimitWindowSec * 1000,
      max: limits.rateLimitMax,
    })
    aiLimiterKey = key
  }
  return aiLimiter(`ai:${ip}`)
}

/**
 * @param {Record<string, unknown>} env
 * @param {ResolveProviderOptions} [options]
 */
export function getAiStatus(env, options = {}) {
  const providers = listConfiguredProviders(env, options)
  const defaultProvider = resolveProvider(env, options)
  const limits = getAiLimits(env)
  return {
    enabled: providers.length > 0,
    provider: defaultProvider?.id ?? null,
    model: defaultProvider?.model ?? null,
    models: defaultProvider?.models ?? (defaultProvider?.model ? [defaultProvider.model] : []),
    cfMode:
      defaultProvider?.id === 'cf' ? (defaultProvider.useBinding ? 'binding' : 'rest') : undefined,
    providers: providers.map(toProviderStatus),
    limits,
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {unknown} body
 * @param {string} ip
 * @param {(level: string, message: string, meta?: object) => Promise<void> | void} [logFn]
 * @param {ResolveProviderOptions} [options]
 */
export async function handleAiComplete(env, body, ip, logFn, options = {}) {
  if (listConfiguredProviders(env, options).length === 0) {
    return {
      status: 503,
      body: { success: false, error: 'AI 服务未配置' },
    }
  }

  const limits = getAiLimits(env)
  const rate = checkAiRateLimit(ip, env)
  if (!rate.allowed) {
    if (logFn) {
      await logFn('warn', 'AI 请求被限流', { ip })
    }
    return {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSec) },
      body: { success: false, error: '请求过于频繁，请稍后再试' },
    }
  }

  const validated = validateCompleteRequest(body, limits.maxInputChars)
  if (!validated.ok) {
    return {
      status: validated.status,
      body: { success: false, error: validated.error },
    }
  }

  const {
    action,
    title,
    content,
    instruction,
    locale,
    model: requestedModel,
    provider: requestedProvider,
    truncated,
  } = validated.data

  const provider = requestedProvider
    ? resolveProviderById(env, requestedProvider, options)
    : resolveProvider(env, options)

  if (!provider) {
    return {
      status: 400,
      body: { success: false, error: requestedProvider ? '无效的提供商' : 'AI 服务未配置' },
    }
  }

  const effectiveModel = pickProviderModel(provider, requestedModel)
  if (requestedModel && !effectiveModel) {
    return {
      status: 400,
      body: { success: false, error: '无效的模型' },
    }
  }

  try {
    const result = await completeAi(
      env,
      {
        action,
        title,
        content,
        instruction,
        locale,
        provider: provider.id,
        model: effectiveModel ?? provider.model,
      },
      options
    )

    if (!result.text) {
      return {
        status: 502,
        body: { success: false, error: 'AI 服务暂时不可用' },
      }
    }

    if (logFn) {
      await logFn('info', 'AI 请求', {
        action,
        provider: provider.id,
        model: effectiveModel ?? provider.model,
        cfMode: provider.useBinding ? 'binding' : undefined,
        ip,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      })
    }

    return {
      status: 200,
      body: {
        success: true,
        text: result.text,
        usage: result.usage,
        truncated: truncated || undefined,
      },
    }
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? e.code : null
    if (code === 'NOT_CONFIGURED') {
      return {
        status: 503,
        body: { success: false, error: 'AI 服务未配置' },
      }
    }

    console.error('[AI] complete failed', e)
    if (logFn) {
      await logFn('error', 'AI 请求失败', {
        action,
        provider: provider.id,
        cfMode: provider.useBinding ? 'binding' : undefined,
        ip,
      })
    }

    return {
      status: 502,
      body: { success: false, error: 'AI 服务暂时不可用' },
    }
  }
}
