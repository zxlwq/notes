import { VALID_ACTIONS } from './config.js'

/**
 * @param {unknown} body
 * @param {number} maxInputChars
 */
export function validateCompleteRequest(body, maxInputChars) {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: '请求体无效' }
  }

  const req = /** @type {Record<string, unknown>} */ (body)
  const action = typeof req.action === 'string' ? req.action.trim() : ''
  if (!VALID_ACTIONS.includes(action)) {
    return { ok: false, status: 400, error: '无效的 action' }
  }

  const title = typeof req.title === 'string' ? req.title : ''
  let content = typeof req.content === 'string' ? req.content : ''
  const instruction = typeof req.instruction === 'string' ? req.instruction.trim() : ''
  const locale = typeof req.locale === 'string' ? req.locale : 'zh-CN'
  const model = typeof req.model === 'string' ? req.model.trim() : ''
  const provider = typeof req.provider === 'string' ? req.provider.trim().toLowerCase() : ''

  if (action === 'custom' && !instruction) {
    return { ok: false, status: 400, error: '自定义指令不能为空' }
  }

  if (!content.trim()) {
    return { ok: false, status: 400, error: '正文内容不能为空' }
  }

  let truncated = false
  if (content.length > maxInputChars) {
    content = content.slice(0, maxInputChars)
    truncated = true
  }

  return {
    ok: true,
    data: { action, title, content, instruction, locale, model, provider, truncated },
  }
}
