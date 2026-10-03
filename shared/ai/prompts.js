const SYSTEM_PROMPT = '你是笔记写作助手，输出简洁 Markdown，不要解释自身身份。'

/**
 * @param {string} action
 * @param {{ title?: string, content: string, instruction?: string, locale?: string }} input
 * @returns {{ role: string, content: string }[]}
 */
export function buildMessages(action, input) {
  const locale = input.locale === 'en' ? 'en' : 'zh-CN'
  const langHint = locale === 'zh-CN' ? '请使用中文。' : 'Please respond in English.'
  const title = (input.title || '').trim()
  const content = input.content.trim()
  const instruction = (input.instruction || '').trim()

  /** @type {string} */
  let userPrompt

  switch (action) {
    case 'summarize':
      userPrompt = `${langHint}\n请用 3–5 句话总结以下笔记内容，输出 Markdown 段落（不要标题）：\n\n标题：${title || '（无）'}\n\n${content}`
      break
    case 'suggest':
      userPrompt = `${langHint}\n请对以下笔记给出改进建议（结构、表达、错别字等），以 Markdown 无序列表输出，每条一行：\n\n标题：${title || '（无）'}\n\n${content}`
      break
    case 'polish':
      userPrompt = `${langHint}\n请润色以下笔记正文：修正语病与错别字、统一语气与标点，保留原意与 Markdown 结构。直接输出润色后的完整正文，不要解释，不要重复标题：\n\n标题：${title || '（无）'}\n\n${content}`
      break
    case 'expand':
      userPrompt = `${langHint}\n请扩写以下笔记正文：在现有内容基础上补充细节与论述，保持风格一致，可适当增加 Markdown 小节。直接输出扩写后的完整正文，不要解释，不要重复标题：\n\n标题：${title || '（无）'}\n\n${content}`
      break
    case 'continue':
      userPrompt = `${langHint}\n根据以下笔记上下文续写一段内容，保持风格一致，直接输出续写正文（不要重复已有内容，不要加解释）：\n\n标题：${title || '（无）'}\n\n${content}`
      break
    case 'tags':
      userPrompt = `${langHint}\n根据以下笔记提取 3–5 个简短标签。只输出 JSON 数组，例如 ["标签1","标签2"]，不要其它文字：\n\n标题：${title || '（无）'}\n\n${content}`
      break
    case 'custom':
      userPrompt = `${langHint}\n用户指令：${instruction}\n\n笔记标题：${title || '（无）'}\n\n笔记内容：\n${content}`
      break
    default:
      throw new Error('unknown action')
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
}
