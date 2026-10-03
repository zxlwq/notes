export function translateLevel(level?: string) {
  if (!level) return '信息'
  const map: Record<string, string> = {
    info: '信息',
    warn: '警告',
    warning: '警告',
    error: '错误',
    debug: '调试',
  }
  return map[level] || level
}
export function translateCountry(codeOrName?: string) {
  if (!codeOrName) return ''
  const code = codeOrName.toUpperCase()
  const map: Record<string, string> = {
    CN: '中国',
    HK: '中国香港',
    MO: '中国澳门',
    TW: '中国台湾',
    US: '美国',
    JP: '日本',
    KR: '韩国',
    SG: '新加坡',
    DE: '德国',
    FR: '法国',
    GB: '英国',
    RU: '俄罗斯',
    AU: '澳大利亚',
    CA: '加拿大',
    IN: '印度',
  }
  return map[code] || codeOrName
}
export function translateCity(city?: string) {
  if (!city) return ''
  const map: Record<string, string> = {
    Beijing: '北京',
    Shanghai: '上海',
    Shenzhen: '深圳',
    Guangzhou: '广州',
    Tokyo: '东京',
    Osaka: '大阪',
    Kyoto: '京都',
    Singapore: '新加坡',
    Seoul: '首尔',
    Busan: '釜山',
    NewYork: '纽约',
    'New York': '纽约',
    LosAngeles: '洛杉矶',
    'Los Angeles': '洛杉矶',
    London: '伦敦',
    Paris: '巴黎',
    Berlin: '柏林',
    Sydney: '悉尼',
    Toronto: '多伦多',
  }
  return map[city] || city
}
export function translateMessage(msg?: string) {
  if (!msg) return ''

  if (msg.includes('Order data saved:')) {
    const keyMatch = msg.match(/Order data saved:\s*([\w-]+)/)
    if (keyMatch) {
      const key = keyMatch[1]
      if (key === 'note-order') return '笔记顺序已保存'
      if (key === 'tag-order') return '标签顺序已保存'
      if (key === 'note') return '笔记顺序已保存'
      if (key === 'tag') return '标签顺序已保存'
      return `位置信息已保存：${key}`
    }
    return '位置信息已保存'
  }

  const map: Record<string, string> = {
    'login.success': '登录成功',
    'login.invalid_password': '登录失败：密码不正确',
    'login.missing_password': '登录失败：缺少密码',
    'login.exception': '登录异常',
    'login:request': '登录请求',
    'login:success': '登录成功',
    'login:failure': '登录失败',
    'login:unhandled': '登录异常',
    'login:log:error': '登录日志写入失败',
    'notes.list': '获取笔记列表',
    'notes.delete': '删除笔记',
    'notes.delete.not_found': '删除笔记失败：未找到',
    'notes.delete.exception': '删除笔记异常',
    'notes.create': '创建笔记',
    'notes.create.exception': '创建笔记异常',
    'notes.update': '更新笔记',
    'notes.update.exception': '更新笔记异常',
    'notes:request': '笔记请求',
    'notes:get:start': '获取笔记列表',
    'notes:get:success': '获取笔记列表成功',
    'notes:get:error': '获取笔记列表失败',
    'notes:post:start': '创建笔记',
    'notes:post:success': '创建笔记成功',
    'notes:post:error': '创建笔记失败',
    'note:request': '单条笔记请求',
    'note:get:start': '获取笔记',
    'note:get:success': '获取笔记成功',
    'note:get:error': '获取笔记失败',
    'note:put:start': '更新笔记',
    'note:put:success': '更新笔记成功',
    'note:put:error': '更新笔记失败',
    'note:delete:start': '删除笔记',
    'note:delete:success': '删除笔记成功',
    'note:delete:error': '删除笔记失败',
    'backup.upload.no_notes': '备份上传：没有可导出的笔记',
    'backup.upload.success': '备份上传成功',
    'backup.upload.failed': '备份上传失败',
    'backup.upload.exception': '备份上传异常',
    'backup.download.success': '备份下载并导入成功',
    'backup.download.failed': '备份下载失败',
    'backup.download.exception': '备份下载异常',
    'backup:get:start': '获取备份',
    'backup:get:success': '获取备份成功',
    'backup:get:error': '获取备份失败',
    'backup:post:start': '创建备份',
    'backup:post:success': '创建备份成功',
    'backup:post:error': '创建备份失败',
    'backup:download:success': '从云端下载笔记成功',
    'backup:download:error': '从云端下载笔记失败',
    'backup:clear:success': '清理笔记成功',
    'backup:clear:error': '清理笔记失败',
    'backup:unhandled': '备份异常',
    'gist:post:no_notes': 'Gist上传：没有可导出的笔记',
    'gist:post:no_token': 'Gist上传：GitHub Token未配置',
    'gist:post:success': 'Gist上传成功',
    'gist:post:error': 'Gist上传失败',
    'gist:get:no_token': 'Gist下载：GitHub Token未配置',
    'gist:get:no_id': 'Gist下载：未找到Gist ID',
    'gist:get:no_content': 'Gist下载：Gist中没有找到笔记内容',
    'gist:get:no_notes': 'Gist下载：Gist文件中没有找到有效的笔记',
    'gist:get:success': 'Gist下载成功',
    'gist:get:error': 'Gist下载失败',
    'gist:unhandled': 'Gist操作异常',
    'gist.upload.no_notes': 'Gist上传：没有可导出的笔记',
    'gist.upload.db_error': 'Gist上传：数据库读取失败',
    'gist.upload.no_token': 'Gist上传：GitHub Token未配置',
    'gist.upload.success': 'Gist上传成功',
    'gist.upload.exception': 'Gist上传异常',
    'gist.download.no_token': 'Gist下载：GitHub Token未配置',
    'gist.download.no_id': 'Gist下载：未找到Gist ID',
    'gist.download.success': 'Gist下载成功',
    'gist.download.exception': 'Gist下载异常',
    'import.invalid_notes': '导入失败：数据无效',
    'Order data saved: note-order': '笔记顺序已保存',
    'Order data saved: tag-order': '标签顺序已保存',
    'Order data saved:': '位置信息已保存',
    'import.note_failed': '单条笔记导入失败',
    'import.exception': '导入异常',
    'import.done': '导入完成',
    'import:request': '导入请求',
    'import:start': '开始导入',
    'import:complete': '导入完成',
    'import:note:error': '单条笔记导入失败',
    'import:error': '导入失败',
    'import:unhandled': '导入异常',
    'password.change.missing_fields': '修改密码失败：缺少参数',
    'password.change.invalid_current': '修改密码失败：当前密码错误',
    'password.change.success': '修改密码成功',
    'password.change.exception': '修改密码异常',
    'password:request': '密码状态请求',
    'password:get:success': '密码状态查询成功',
    'password:get:error': '密码状态查询失败',
    'password:unhandled': '密码状态异常',
    'order.saved': '顺序数据已保存',
    'order.get_error': '获取顺序失败',
    'order.post_error': '保存顺序失败',
    'order:unhandled': '顺序操作异常',
    'cleared old notes from postgres': '清理旧笔记',
    '笔记已创建/更新': '笔记已创建/更新',
    笔记已更新: '笔记已更新',
    笔记已删除: '笔记已删除',
    笔记已导入: '笔记已导入',
    笔记已上传到云端: '笔记已上传到云端',
    笔记已保存到本地: '笔记已保存到本地',
    笔记已从云端下载并导入: '笔记已从云端下载并导入',
    'GitHub Token未配置': 'GitHub Token未配置',
    Gist中没有找到笔记内容: 'Gist中没有找到笔记内容',
    Gist文件中没有找到有效的笔记: 'Gist文件中没有找到有效的笔记',
    'GitHub Gist 上传失败': 'GitHub Gist 上传失败',
    'GitHub Gist 上传异常': 'GitHub Gist 上传异常',
    'GitHub Gist 下载失败': 'GitHub Gist 下载失败',
    成功上传到Gist: '成功上传到Gist',
    成功从Gist导入: '成功从Gist导入',
    没有可导出的笔记: '没有可导出的笔记',
    备份失败: '备份失败',
    下载失败: '下载失败',
    导入失败: '导入失败',
    后台导入失败: '后台导入失败',
    保存顺序失败: '保存顺序失败',
    获取笔记失败: '获取笔记失败',
    创建笔记失败: '创建笔记失败',
    更新笔记失败: '更新笔记失败',
    删除笔记失败: '删除笔记失败',
    用户登录成功: '用户登录成功',
    用户登录失败: '用户登录失败',
    服务器已启动: '服务器已启动',
    测试日志条目: '测试日志条目',
    'r2.upload.success': 'R2上传成功',
    'r2.upload.failed': 'R2上传失败',
    'r2.upload.exception': 'R2上传异常',
    'r2.download.success': 'R2下载成功',
    'r2.download.failed': 'R2下载失败',
    'r2.download.exception': 'R2下载异常',
    'r2:post:success': 'R2上传成功',
    'r2:post:error': 'R2上传失败',
    'r2:get:success': 'R2下载成功',
    'r2:get:error': 'R2下载失败',
    成功上传到R2: '成功上传到R2',
    成功从R2导入: '成功从R2导入',
    'R2 上传失败': 'R2上传失败',
    'R2 上传异常': 'R2上传异常',
    'R2 下载失败': 'R2下载失败',
    R2未配置: 'R2未配置',
    笔记已成功上传到R2: '笔记已成功上传到R2',
    笔记已成功从R2下载并导入: '笔记已成功从R2下载并导入',
    R2文件中没有找到有效的笔记: 'R2文件中没有找到有效的笔记',
  }
  return map[msg] || msg
}
export function formatLogTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (isNaN(date.getTime())) return String(value)
  return date
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai',
    })
    .replace(/\//g, '-')
}
export function formatMeta(msg?: string, meta?: unknown) {
  if (!meta) return '-'

  // Handle string meta first
  if (typeof meta === 'string') {
    // Check if it's a simple string with IP: pattern
    if (msg === '用户登录成功' || msg === '用户登录失败') {
      if (meta.includes('IP:')) {
        return msg === '用户登录失败' ? `登录失败 · ${meta}` : meta
      }
    }

    try {
      const parsed = JSON.parse(meta)
      if (typeof parsed === 'object' && parsed !== null) {
        meta = parsed
      } else {
        return meta
      }
    } catch {
      return meta
    }
  }

  // At this point, meta is either an object or was already returned as string
  if (typeof meta !== 'object' || meta === null) {
    return typeof meta === 'string' ? meta : JSON.stringify(meta)
  }

  try {
    const obj = meta as Record<string, unknown>

    if (msg && /:request$/.test(msg)) {
      const method =
        (typeof obj.method === 'string' ? obj.method : null) ||
        (obj.req && typeof obj.req === 'object' && 'method' in obj.req
          ? String(obj.req.method)
          : null)
      let path = ''
      if (typeof obj.url === 'string' && obj.url) {
        try {
          const u = new URL(obj.url)
          path = u.pathname || obj.url
        } catch {
          path = obj.url
        }
      }
      const parts: string[] = []
      if (method) parts.push(`方法：${method}`)
      if (path) parts.push(`路径：${path}`)
      return parts.join(' · ') || JSON.stringify(obj, null, 2)
    }

    const directTitle = typeof obj.title === 'string' && obj.title.trim()
    const noteObj =
      obj.note && typeof obj.note === 'object' ? (obj.note as Record<string, unknown>) : null
    const nestedTitle = noteObj && typeof noteObj.title === 'string' ? noteObj.title.trim() : ''
    if (directTitle) {
      return obj.title as string
    }
    if (nestedTitle) {
      return nestedTitle
    }

    if (msg === 'notes.list' && typeof obj.count === 'number') {
      return `笔记数量：${obj.count}`
    }
    if (msg === 'notes.delete' || msg === 'notes.delete.not_found') {
      if (typeof obj.title === 'string' && obj.title.trim()) return obj.title
      if (typeof obj.id === 'string') return `ID：${obj.id}`
    }
    if (msg === 'backup.upload.success' && typeof obj.totalNotes === 'number') {
      return `备份文件：${typeof obj.fileName === 'string' ? obj.fileName : '-'} 笔记数量：${obj.totalNotes}`
    }
    if (msg === 'backup.download.success' && typeof obj.importedCount === 'number') {
      return `备份文件：${typeof obj.fileName === 'string' ? obj.fileName : 'notes.md'} 笔记数量：${obj.importedCount}`
    }
    if (msg === 'backup:download:success' && typeof obj.importedCount === 'number') {
      return `文件：${typeof obj.fileName === 'string' ? obj.fileName : 'notes.md'} · 导入：${obj.importedCount} 条 · 更新：${typeof obj.updatedCount === 'number' ? obj.updatedCount : 0} 条`
    }
    if (msg === '从云端下载笔记成功' && typeof obj.importedCount === 'number') {
      return `文件：${typeof obj.fileName === 'string' ? obj.fileName : 'notes.md'} · 导入：${obj.importedCount} 条 · 更新：${typeof obj.updatedCount === 'number' ? obj.updatedCount : 0} 条`
    }

    if (msg === 'gist:post:success' || msg === 'gist.upload.success') {
      const parts: string[] = []
      if (obj.gistId) {
        parts.push(`Gist ID：${String(obj.gistId)}`)
      }
      if (typeof obj.count === 'number') {
        parts.push(`笔记数量：${obj.count}`)
      }
      if (typeof obj.totalNotes === 'number') {
        parts.push(`笔记数量：${obj.totalNotes}`)
      }
      if (typeof obj.fileName === 'string') {
        parts.push(`文件：${obj.fileName}`)
      }
      return parts.length > 0 ? parts.join(' · ') : JSON.stringify(obj, null, 2)
    }

    if (msg === 'gist:get:success' || msg === 'gist.download.success') {
      const parts: string[] = []
      if (obj.gistId) {
        parts.push(`Gist ID：${String(obj.gistId)}`)
      }
      if (typeof obj.importedCount === 'number') {
        parts.push(`导入：${obj.importedCount} 条`)
      }
      if (typeof obj.fileName === 'string') {
        parts.push(`文件：${obj.fileName}`)
      }
      return parts.length > 0 ? parts.join(' · ') : JSON.stringify(obj, null, 2)
    }

    if (
      msg === 'gist:post:error' ||
      msg === 'gist:get:error' ||
      msg === 'gist.upload.exception' ||
      msg === 'gist.download.exception'
    ) {
      if (typeof obj.message === 'string') {
        return `错误：${obj.message}`
      }
      return JSON.stringify(obj, null, 2)
    }
    if (
      msg === '成功上传到Gist' ||
      msg === '成功从Gist导入' ||
      msg === '笔记已成功从GitHub Gist下载并导入'
    ) {
      const parts: string[] = []
      if (obj.gistId) {
        parts.push(`Gist ID：${String(obj.gistId)}`)
      }
      if (typeof obj.count === 'number') {
        parts.push(`笔记数量：${obj.count}`)
      }
      if (typeof obj.importedCount === 'number') {
        parts.push(`导入：${obj.importedCount} 条`)
      }
      if (typeof obj.fileName === 'string') {
        parts.push(`文件：${obj.fileName}`)
      }
      return parts.length > 0 ? parts.join(' · ') : JSON.stringify(obj, null, 2)
    }

    if (
      msg === 'r2.upload.success' ||
      msg === 'r2:post:success' ||
      msg === '成功上传到R2' ||
      msg === '笔记已成功上传到R2'
    ) {
      const parts: string[] = []
      if (typeof obj.fileName === 'string') {
        parts.push(`文件：${obj.fileName}`)
      }
      if (typeof obj.totalNotes === 'number') {
        parts.push(`笔记数量：${obj.totalNotes}`)
      }
      if (typeof obj.count === 'number') {
        parts.push(`笔记数量：${obj.count}`)
      }
      return parts.length > 0 ? parts.join(' · ') : JSON.stringify(obj, null, 2)
    }

    if (
      msg === 'r2.download.success' ||
      msg === 'r2:get:success' ||
      msg === '成功从R2导入' ||
      msg === '笔记已成功从R2下载并导入'
    ) {
      const parts: string[] = []
      if (typeof obj.fileName === 'string') {
        parts.push(`文件：${obj.fileName}`)
      }
      if (typeof obj.importedCount === 'number') {
        parts.push(`导入：${obj.importedCount} 条`)
      }
      if (typeof obj.updatedCount === 'number') {
        parts.push(`更新：${obj.updatedCount} 条`)
      }
      if (typeof obj.totalNotes === 'number') {
        parts.push(`总计：${obj.totalNotes} 条`)
      }
      return parts.length > 0 ? parts.join(' · ') : JSON.stringify(obj, null, 2)
    }

    if (
      msg === 'r2.upload.failed' ||
      msg === 'r2.upload.exception' ||
      msg === 'r2:post:error' ||
      msg === 'r2.download.failed' ||
      msg === 'r2.download.exception' ||
      msg === 'r2:get:error' ||
      msg === 'R2 上传失败' ||
      msg === 'R2 上传异常' ||
      msg === 'R2 下载失败'
    ) {
      const errorMsg =
        typeof obj.error === 'string'
          ? obj.error
          : typeof obj.message === 'string'
            ? obj.message
            : null
      if (errorMsg) {
        return `错误：${errorMsg}`
      }
      return JSON.stringify(obj, null, 2)
    }

    if (msg === '笔记已创建/更新' && typeof obj.id === 'string') {
      return `笔记 ID：${obj.id}`
    }

    if (msg === '笔记已更新' && typeof obj.id === 'string') {
      return `笔记 ID：${obj.id}`
    }

    if (msg === '笔记已删除' && typeof obj.id === 'string') {
      return `笔记 ID：${obj.id}`
    }

    if (
      (msg === '导入失败' ||
        msg === '备份失败' ||
        msg === '下载失败' ||
        msg === '后台导入失败' ||
        msg === '获取笔记失败' ||
        msg === '创建笔记失败' ||
        msg === '更新笔记失败' ||
        msg === '删除笔记失败' ||
        msg === 'GitHub Gist 上传失败' ||
        msg === 'GitHub Gist 上传异常' ||
        msg === 'GitHub Gist 下载失败') &&
      typeof obj.error === 'string'
    ) {
      return `错误：${obj.error}`
    }

    if (msg === 'backup:post:success' && typeof obj.count === 'number') {
      return `备份创建成功 · 笔记数量：${obj.count}`
    }
    if (msg === '创建备份成功' && typeof obj.count === 'number') {
      return `备份创建成功 · 笔记数量：${obj.count}`
    }
    if (msg === 'backup:clear:success' && typeof obj.clearedCount === 'number') {
      return `已清理 ${obj.clearedCount} 条笔记`
    }
    if (msg === 'import.done' && typeof obj.imported === 'number') {
      const total = typeof obj.total === 'number' ? obj.total : '?'
      return `导入成功：${obj.imported} / ${total}`
    }
    if (msg === 'backup.upload.failed' && typeof obj.status === 'number') {
      return `上传失败：状态码 ${obj.status}`
    }
    if (msg === 'backup.download.failed' && typeof obj.status === 'number') {
      return `下载失败：状态码 ${obj.status}`
    }
    if (msg === 'backup.upload.exception' && typeof obj.message === 'string') {
      return `上传异常：${obj.message}`
    }
    if (msg === 'backup.download.exception' && typeof obj.message === 'string') {
      return `下载异常：${obj.message}`
    }
    if (msg === 'notes.create' && typeof obj.id === 'string') {
      return `创建笔记：${obj.id}`
    }
    if (msg === 'notes.update' && typeof obj.id === 'string') {
      return `更新笔记：${obj.id}`
    }
    if (msg === 'notes.delete' && typeof obj.id === 'string') {
      return `删除笔记：${obj.id}`
    }
    if (msg === 'notes:get:success' && typeof obj.count === 'number') {
      return `笔记数量：${obj.count}`
    }
    if (msg === 'notes:post:success' && typeof obj.id === 'string') {
      return `创建笔记：${obj.id}`
    }
    if (msg === 'note:get:success' && typeof obj.id === 'string') {
      return `获取笔记：${obj.id}`
    }
    if (msg === 'note:put:success' && typeof obj.id === 'string') {
      return `更新笔记：${obj.id}`
    }
    if (msg === 'note:delete:success' && typeof obj.id === 'string') {
      return `删除笔记：${obj.id}`
    }
    if (msg === 'notes.create.exception' && typeof obj.error === 'string') {
      return `创建异常：${obj.error}`
    }
    if (msg === 'notes.update.exception' && typeof obj.error === 'string') {
      return `更新异常：${obj.error}`
    }
    if (msg === 'notes.delete.exception' && typeof obj.error === 'string') {
      return `删除异常：${obj.error}`
    }
    if (msg === 'import.note_failed' && typeof obj.title === 'string') {
      return `导入失败：${obj.title}`
    }
    if (msg === 'import.exception' && typeof obj.message === 'string') {
      return `导入异常：${obj.message}`
    }
    if (msg === 'import:complete') {
      const imported = obj.importedCount ?? obj.imported
      const errors = typeof obj.errorCount === 'number' ? obj.errorCount : 0
      const importedNum = typeof imported === 'number' ? imported : 0
      const total =
        typeof obj.totalNotes === 'number'
          ? obj.totalNotes
          : typeof obj.total === 'number'
            ? obj.total
            : importedNum + errors
      const parts: string[] = []
      if (typeof imported === 'number') parts.push(`导入成功：${imported}`)
      if (typeof errors === 'number') parts.push(`失败：${errors}`)
      if (typeof total === 'number') parts.push(`总数：${total}`)
      return parts.length ? parts.join(' / ') : JSON.stringify(obj, null, 2)
    }
    if (msg === 'import:note:error') {
      const title = typeof obj.title === 'string' ? obj.title : null
      const id = typeof obj.id === 'string' ? obj.id : null
      if (title || id) {
        return `导入失败：${title || id}`
      }
    }
    if (
      msg === 'login.success' &&
      (typeof obj.country === 'string' ||
        typeof obj.city === 'string' ||
        typeof obj.ip === 'string')
    ) {
      const country = typeof obj.country === 'string' ? obj.country : undefined
      const city = typeof obj.city === 'string' ? obj.city : undefined
      const ip = typeof obj.ip === 'string' ? obj.ip : undefined
      const loc = [translateCountry(country), translateCity(city)].filter(Boolean).join(' / ')
      const ipPart = ip ? ` · IP：${ip}` : ''
      return loc ? `位置：${loc}${ipPart}` : ip ? `IP：${ip}` : '-'
    }
    if (
      msg === 'login:success' &&
      (typeof obj.country === 'string' ||
        typeof obj.city === 'string' ||
        typeof obj.ip === 'string')
    ) {
      const country = typeof obj.country === 'string' ? obj.country : undefined
      const city = typeof obj.city === 'string' ? obj.city : undefined
      const ip = typeof obj.ip === 'string' ? obj.ip : undefined
      const loc = [translateCountry(country), translateCity(city)].filter(Boolean).join(' / ')
      const ipPart = ip ? ` · IP：${ip}` : ' · IP：未知'
      return loc ? `位置：${loc}${ipPart}` : 'IP：未知'
    }
    if (msg === 'login:failure' && typeof obj.ip === 'string') {
      return `登录失败 · IP：${obj.ip}`
    }
    if (msg === '用户登录成功') {
      if (typeof obj.ip === 'string') {
        return `IP：${obj.ip}`
      }
      return 'IP：未知'
    }
    if (msg === '用户登录失败') {
      if (typeof obj.ip === 'string') {
        return `登录失败 · IP：${obj.ip}`
      }
      return '登录失败 · IP：未知'
    }
    if (msg === 'password:get:success') {
      const dbHasPassword = typeof obj.dbHasPassword === 'boolean' ? obj.dbHasPassword : false
      const effectivePassword =
        typeof obj.effectivePassword === 'boolean' ? obj.effectivePassword : false
      const source = dbHasPassword ? '数据库' : '环境变量'
      const setStr = effectivePassword ? '是' : '否'
      return `来源：${source} / 已设置：${setStr}`
    }
    if (msg === 'cleared old notes from postgres') {
      if (typeof obj.count === 'number') {
        return `已清理 ${obj.count} 条笔记`
      }
      return '已清理旧笔记'
    }
    if (msg && msg.includes('Order data saved:')) {
      const key = typeof obj.key === 'string' ? obj.key : null
      if (key) {
        if (key === 'note-order') return '笔记顺序'
        if (key === 'tag-order') return '标签顺序'
        return key
      }
      return '位置信息'
    }
    if (msg === 'order.saved' && typeof obj.key === 'string') {
      const type =
        obj.key === 'note-order' ? '笔记顺序' : obj.key === 'tag-order' ? '标签顺序' : obj.key
      return type
    }
    if (msg && msg.includes('Order')) {
      const keyValue =
        typeof obj.key === 'string'
          ? obj.key
          : typeof obj.id === 'string'
            ? obj.id
            : typeof obj.type === 'string'
              ? obj.type
              : null
      if (keyValue) {
        const type =
          keyValue === 'note-order' ? '笔记顺序' : keyValue === 'tag-order' ? '标签顺序' : keyValue
        return type
      }
    }
    if (typeof obj.key === 'string') {
      const type =
        obj.key === 'note-order' ? '笔记顺序' : obj.key === 'tag-order' ? '标签顺序' : obj.key
      return type
    }
    return JSON.stringify(obj, null, 2)
  } catch {
    return typeof meta === 'string' ? meta : JSON.stringify(meta)
  }
}
