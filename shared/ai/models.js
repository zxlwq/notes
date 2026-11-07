/** 解析环境变量中的模型列表（逗号分隔） */
export function parseModelList(raw) {
  return String(raw ?? '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {{ models?: string[], model?: string } | null | undefined} provider
 * @param {string} [requested]
 * @returns {string | null}
 */
export function pickProviderModel(provider, requested) {
  if (!provider) return null
  const models = provider.models?.length ? provider.models : provider.model ? [provider.model] : []
  if (models.length === 0) return null
  if (!requested) return models[0]
  return models.includes(requested) ? requested : null
}
