/** 生产环境静默 debug 日志；设置 DEBUG=true 或 ENVIRONMENT=development 开启 */
export function isDev(env) {
  if (!env) return false
  const debug = env.DEBUG
  if (debug === '1' || debug === 'true') return true
  return env.ENVIRONMENT === 'development'
}

export function trace(env, ...args) {
  if (isDev(env)) console.warn(...args)
}
