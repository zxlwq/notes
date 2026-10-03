/**
 * Cloudflare Pages Workers AI 绑定（env.AI.run）
 * @see https://developers.cloudflare.com/workers-ai/get-started/workers-bindings/
 */

/**
 * @param {unknown} aiBinding
 * @returns {boolean}
 */
export function isWorkersAiBinding(aiBinding) {
  return Boolean(
    aiBinding && typeof (/** @type {{ run?: unknown }} */ (aiBinding).run) === 'function'
  )
}

/**
 * @param {unknown} result
 * @returns {string}
 */
export function extractWorkersAiText(result) {
  if (typeof result === 'string') return result.trim()

  if (result && typeof result === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (result)
    const direct = obj.response ?? obj.content ?? obj.output ?? obj.text
    if (typeof direct === 'string') return direct.trim()

    const choices = obj.choices
    if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
      const msg = /** @type {{ message?: { content?: unknown } }} */ (choices[0]).message
      if (typeof msg?.content === 'string') return msg.content.trim()
    }
  }

  return ''
}

/**
 * @param {{ run: (model: string, inputs: object) => Promise<unknown> }} aiBinding
 * @param {string} model
 * @param {{ messages: { role: string, content: string }[], maxTokens: number, temperature: number }} opts
 */
export async function completeCloudflareBinding(
  aiBinding,
  model,
  { messages, maxTokens, temperature }
) {
  const response = await aiBinding.run(model, {
    messages,
    max_tokens: maxTokens,
    temperature,
  })

  const text = extractWorkersAiText(response)

  return {
    text,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
    },
  }
}
