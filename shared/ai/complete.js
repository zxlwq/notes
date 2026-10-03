import { resolveProvider, resolveProviderById } from './providers.js'
import { buildMessages } from './prompts.js'
import { completeOpenAiChat } from './openai.js'
import { completeCloudflareChat } from './cloudflare.js'
import { completeCloudflareBinding } from './cloudflare-binding.js'
import { ACTION_TEMPERATURE, AI_MAX_OUTPUT_TOKENS } from './config.js'

/**
 * @typedef {import('./providers.js').ProviderConfig} ProviderConfig
 * @typedef {import('./providers.js').ResolveProviderOptions} ResolveProviderOptions
 * @typedef {object} AiCompleteInput
 * @property {string} action
 * @property {string} title
 * @property {string} content
 * @property {string} instruction
 * @property {string} locale
 * @property {string} [model]
 * @property {string} [provider]
 */

/**
 * @param {ProviderConfig} provider
 * @param {AiCompleteInput} input
 * @param {ResolveProviderOptions} [options]
 */
export function runAiComplete(provider, input, options = {}) {
  const messages = buildMessages(input.action, {
    title: input.title,
    content: input.content,
    instruction: input.instruction,
    locale: input.locale,
  })

  const temperature = ACTION_TEMPERATURE[input.action] ?? 0.5
  const opts = {
    messages,
    maxTokens: AI_MAX_OUTPUT_TOKENS,
    temperature,
  }

  if (provider.type === 'cloudflare') {
    if (provider.useBinding && options.aiBinding) {
      return completeCloudflareBinding(
        /** @type {{ run: (model: string, inputs: object) => Promise<unknown> }} */ (
          options.aiBinding
        ),
        provider.model,
        opts
      )
    }
    return completeCloudflareChat(provider, opts)
  }

  return completeOpenAiChat(provider, opts)
}

/**
 * @param {Record<string, unknown>} env
 * @param {AiCompleteInput} input
 * @param {ResolveProviderOptions} [options]
 */
export function completeAi(env, input, options = {}) {
  const provider = input.provider
    ? resolveProviderById(env, input.provider, options)
    : resolveProvider(env, options)
  if (!provider) {
    const err = /** @type {Error & { code: string }} */ (new Error('not configured'))
    err.code = 'NOT_CONFIGURED'
    throw err
  }

  const model = input.model && provider.models.includes(input.model) ? input.model : provider.model

  return runAiComplete({ ...provider, model }, input, options)
}
