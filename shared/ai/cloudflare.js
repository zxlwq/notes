/**
 * @typedef {import('./providers.js').ProviderConfig} ProviderConfig
 */

/**
 * @param {ProviderConfig} config
 * @param {{ messages: { role: string, content: string }[], maxTokens: number, temperature: number }} opts
 */
export async function completeCloudflareChat(config, { messages, maxTokens, temperature }) {
  const accountId = config.accountId
  if (!accountId) throw new Error('missing account')

  const model = encodeURIComponent(config.model)
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[AI] Cloudflare upstream error', res.status, errText.slice(0, 300))
    throw new Error('upstream')
  }

  const data = await res.json()
  if (data?.success === false) {
    console.error('[AI] Cloudflare API error', JSON.stringify(data?.errors ?? []).slice(0, 300))
    throw new Error('upstream')
  }

  const result = data?.result
  let text = ''
  if (typeof result === 'string') {
    text = result
  } else if (result && typeof result === 'object') {
    text = String(result.response ?? result.content ?? result.output ?? '').trim()
    if (!text && result.choices?.[0]?.message?.content) {
      text = String(result.choices[0].message.content).trim()
    }
  }

  return {
    text,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
    },
  }
}
