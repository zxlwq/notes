/**
 * @param {Record<string, unknown>} env
 */
export function getAiLimits(env) {
  return {
    maxInputChars: Math.max(1000, parseInt(String(env.AI_MAX_INPUT_CHARS ?? '32000'), 10) || 32000),
    rateLimitMax: Math.max(1, parseInt(String(env.AI_RATE_LIMIT_MAX ?? '20'), 10) || 20),
    rateLimitWindowSec: Math.max(
      60,
      parseInt(String(env.AI_RATE_LIMIT_WINDOW_SEC ?? '3600'), 10) || 3600
    ),
  }
}

export const AI_MAX_OUTPUT_TOKENS = 2048

/** @type {Record<string, number>} */
export const ACTION_TEMPERATURE = {
  summarize: 0.3,
  suggest: 0.5,
  polish: 0.4,
  expand: 0.65,
  continue: 0.7,
  tags: 0.3,
  custom: 0.5,
}

export const VALID_ACTIONS = [
  'summarize',
  'suggest',
  'polish',
  'expand',
  'continue',
  'tags',
  'custom',
]
