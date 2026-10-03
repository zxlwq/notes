/**
 * @typedef {import('./providers.js').ProviderConfig} ProviderConfig
 */

/**
 * @param {ProviderConfig} config
 * @param {{ messages: { role: string, content: string }[], maxTokens: number, temperature: number }} opts
 */
export async function completeOpenAiChat(config, { messages, maxTokens, temperature }) {
  const base = config.baseUrl || 'https://api.openai.com/v1'
  const url = `${base}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[AI] OpenAI-compatible upstream error', res.status, errText.slice(0, 300))
    throw new Error('upstream')
  }

  const data = await res.json()
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim()

  return {
    text,
    usage: {
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
    },
  }
}
