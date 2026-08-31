/** @typedef {'openai' | 'cloudflare'} ProviderType */

/**
 * @typedef {object} ProviderConfig
 * @property {string} id
 * @property {ProviderType} type
 * @property {string} apiKey
 * @property {string} model
 * @property {string[]} models
 * @property {string} [baseUrl]
 * @property {string} [accountId]
 * @property {Record<string, string>} [extraHeaders]
 * @property {boolean} [useBinding]
 */

/** @typedef {{ aiBinding?: unknown }} ResolveProviderOptions */

import { parseModelList } from './models.js'

/** @type {Array<{ id: string, type: ProviderType, keyEnv: string, modelEnv: string, baseUrlEnv?: string, defaultBaseUrl?: string, accountIdEnv?: string, extraHeaders?: Record<string, string> }>} */
export const PROVIDER_DEFS = [
  {
    id: 'openai',
    type: 'openai',
    keyEnv: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
    modelEnv: 'OPENAI_MODEL_NAME',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'ark',
    type: 'openai',
    keyEnv: 'ARK_API_KEY',
    baseUrlEnv: 'ARK_BASE_URL',
    modelEnv: 'ARK_MODEL_NAME',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  {
    id: 'kilo',
    type: 'openai',
    keyEnv: 'KILO_API_KEY',
    baseUrlEnv: 'KILO_BASE_URL',
    modelEnv: 'KILO_MODEL_NAME',
    defaultBaseUrl: 'https://api.kilo.ai/api/gateway',
  },
  {
    id: 'cf',
    type: 'cloudflare',
    keyEnv: 'CF_API_KEY',
    modelEnv: 'CF_MODEL_NAME',
    accountIdEnv: 'CF_ACCOUNT_ID',
  },
  {
    id: 'zhipu',
    type: 'openai',
    keyEnv: 'ZHIPU_API_KEY',
    baseUrlEnv: 'ZHIPU_BASE_URL',
    modelEnv: 'ZHIPU_MODEL_NAME',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'gh',
    type: 'openai',
    keyEnv: 'GH_API_KEY',
    baseUrlEnv: 'GH_BASE_URL',
    modelEnv: 'GH_MODEL_NAME',
    defaultBaseUrl: 'https://models.github.ai/inference',
    extraHeaders: { Accept: 'application/vnd.github+json' },
  },
]

const CF_DEF = PROVIDER_DEFS.find((p) => p.id === 'cf')

/**
 * @param {Record<string, unknown>} env
 * @param {{ id: string, keyEnv: string, modelEnv: string, accountIdEnv?: string, type: ProviderType, baseUrlEnv?: string, defaultBaseUrl?: string, extraHeaders?: Record<string, string> }} def
 */
export function isProviderConfigured(def, env) {
  const key = String(env[def.keyEnv] ?? '').trim()
  const models = parseModelList(env[def.modelEnv])
  if (!key || models.length === 0) return false
  if (def.type === 'cloudflare') {
    return Boolean(String(env[def.accountIdEnv] ?? '').trim())
  }
  return true
}

/**
 * @param {Record<string, unknown>} env
 * @param {unknown} [aiBinding]
 */
export function isCfBindingConfigured(env, aiBinding) {
  const models = parseModelList(env.CF_MODEL_NAME)
  if (models.length === 0) return false
  return Boolean(
    aiBinding && typeof (/** @type {{ run?: unknown }} */ (aiBinding).run) === 'function'
  )
}

/**
 * @param {Record<string, unknown>} env
 * @returns {ProviderConfig}
 */
function buildCfBindingProvider(env) {
  const models = parseModelList(env.CF_MODEL_NAME)
  return {
    id: 'cf',
    type: 'cloudflare',
    apiKey: '',
    model: models[0],
    models,
    useBinding: true,
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {unknown} [aiBinding]
 * @returns {ProviderConfig | null}
 */
function resolveCfProvider(env, aiBinding) {
  if (isCfBindingConfigured(env, aiBinding)) {
    return buildCfBindingProvider(env)
  }
  if (CF_DEF && isProviderConfigured(CF_DEF, env)) {
    return buildProviderConfig(CF_DEF, env)
  }
  return null
}

/**
 * @param {Record<string, unknown>} env
 * @returns {string[] | null} null = 不限制，返回全部已配置项
 */
export function parseProviderAllowlist(env) {
  const raw = String(env.AI_PROVIDER ?? '').trim()
  if (!raw) return null
  const ids = raw
    .split(/[,，|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return ids.length > 0 ? ids : null
}

/**
 * @param {ProviderConfig} provider
 */
export function toProviderStatus(provider) {
  return {
    id: provider.id,
    model: provider.model,
    models: provider.models,
    cfMode: provider.id === 'cf' ? (provider.useBinding ? 'binding' : 'rest') : undefined,
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {ResolveProviderOptions} [options]
 * @returns {ProviderConfig[]}
 */
export function listConfiguredProviders(env, options = {}) {
  const { aiBinding = null } = options
  const allowlist = parseProviderAllowlist(env)
  /** @type {ProviderConfig[]} */
  const out = []

  for (const def of PROVIDER_DEFS) {
    if (def.id === 'cf') {
      const cf = resolveCfProvider(env, aiBinding)
      if (cf && (!allowlist || allowlist.includes('cf'))) out.push(cf)
      continue
    }
    if (isProviderConfigured(def, env) && (!allowlist || allowlist.includes(def.id))) {
      out.push(buildProviderConfig(def, env))
    }
  }

  return out
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} providerId
 * @param {ResolveProviderOptions} [options]
 * @returns {ProviderConfig | null}
 */
export function resolveProviderById(env, providerId, options = {}) {
  const id = String(providerId ?? '')
    .trim()
    .toLowerCase()
  if (!id) return null
  return listConfiguredProviders(env, options).find((p) => p.id === id) ?? null
}

/**
 * @param {Record<string, unknown>} env
 * @param {ResolveProviderOptions} [options]
 * @returns {ProviderConfig | null}
 */
export function resolveProvider(env, options = {}) {
  const providers = listConfiguredProviders(env, options)
  if (providers.length === 0) return null

  const allowlist = parseProviderAllowlist(env)
  if (allowlist) {
    for (const id of allowlist) {
      const found = providers.find((p) => p.id === id)
      if (found) return found
    }
    return null
  }

  return providers[0]
}

/**
 * @param {typeof PROVIDER_DEFS[number]} def
 * @param {Record<string, unknown>} env
 * @returns {ProviderConfig}
 */
function buildProviderConfig(def, env) {
  const baseRaw = def.baseUrlEnv
    ? String(env[def.baseUrlEnv] ?? def.defaultBaseUrl ?? '').trim()
    : ''
  const models = parseModelList(env[def.modelEnv])
  return {
    id: def.id,
    type: def.type,
    apiKey: String(env[def.keyEnv] ?? '').trim(),
    model: models[0],
    models,
    baseUrl: baseRaw.replace(/\/$/, ''),
    accountId: def.accountIdEnv ? String(env[def.accountIdEnv] ?? '').trim() : undefined,
    extraHeaders: def.extraHeaders,
  }
}
