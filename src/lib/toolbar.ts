export interface ToolbarTool {
  id: string
  title: string
  ariaLabel: string
  prefix: string
  suffix: string
  icon: string
  label: string
  iconStyle?: Record<string, string | number>
}

export const TOOLBAR_TOOLS: ToolbarTool[] = [
  {
    id: 'task',
    title: '任务列表',
    ariaLabel: '插入任务列表',
    prefix: '- [ ] ',
    suffix: '',
    icon: '☐',
    label: '任务列表',
  },
  {
    id: 'link',
    title: '链接',
    ariaLabel: '插入链接',
    prefix: '[',
    suffix: '](url)',
    icon: '🔗',
    label: '链接',
  },
  {
    id: 'image',
    title: '图片',
    ariaLabel: '插入图片',
    prefix: '![',
    suffix: '](url)',
    icon: '🖼️',
    label: '图片',
  },
  {
    id: 'bold',
    title: '粗体',
    ariaLabel: '插入粗体',
    prefix: '**',
    suffix: '**',
    icon: 'B',
    label: '粗体',
  },
  {
    id: 'italic',
    title: '斜体',
    ariaLabel: '插入斜体',
    prefix: '*',
    suffix: '*',
    icon: 'I',
    label: '斜体',
  },
  {
    id: 'code',
    title: '代码块',
    ariaLabel: '插入代码块',
    prefix: '```\n',
    suffix: '\n```',
    icon: '</>',
    label: '代码块',
  },
  {
    id: 'h1',
    title: '标题',
    ariaLabel: '插入一级标题',
    prefix: '# ',
    suffix: '',
    icon: 'H1',
    label: '标题',
  },
  {
    id: 'h2',
    title: '二级标题',
    ariaLabel: '插入二级标题',
    prefix: '## ',
    suffix: '',
    icon: 'H2',
    label: '二级标题',
  },
  {
    id: 'h3',
    title: '三级标题',
    ariaLabel: '插入三级标题',
    prefix: '### ',
    suffix: '',
    icon: 'H3',
    label: '三级标题',
  },
  {
    id: 'highlight',
    title: '高亮',
    ariaLabel: '插入高亮',
    prefix: '==',
    suffix: '==',
    icon: 'M',
    label: '高亮',
  },
  {
    id: 'underline',
    title: '下划线',
    ariaLabel: '插入下划线',
    prefix: '<u>',
    suffix: '</u>',
    icon: 'U',
    label: '下划线',
    iconStyle: { textDecoration: 'underline' },
  },
  {
    id: 'strike',
    title: '删除线',
    ariaLabel: '插入删除线',
    prefix: '~~',
    suffix: '~~',
    icon: 'S',
    label: '删除线',
  },
  {
    id: 'quote',
    title: '引用',
    ariaLabel: '插入引用',
    prefix: '> ',
    suffix: '',
    icon: '>',
    label: '引用',
  },
  {
    id: 'ul',
    title: '无序列表',
    ariaLabel: '插入无序列表',
    prefix: '- ',
    suffix: '',
    icon: '•',
    label: '无序列表',
  },
  {
    id: 'ol',
    title: '有序列表',
    ariaLabel: '插入有序列表',
    prefix: '1. ',
    suffix: '',
    icon: '1.',
    label: '有序列表',
  },
]

export const DEFAULT_TOOLBAR_ORDER = TOOLBAR_TOOLS.map((t) => t.id)

const STORAGE_KEY = 'toolbar-order'

export function readToolbarOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TOOLBAR_ORDER
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_TOOLBAR_ORDER
    const known = new Set(DEFAULT_TOOLBAR_ORDER)
    const saved = parsed.filter((id): id is string => typeof id === 'string' && known.has(id))
    const missing = DEFAULT_TOOLBAR_ORDER.filter((id) => !saved.includes(id))
    return saved.length ? [...saved, ...missing] : DEFAULT_TOOLBAR_ORDER
  } catch {
    return DEFAULT_TOOLBAR_ORDER
  }
}

export function saveToolbarOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {}
}

export function orderToolbarTools(order: string[]): ToolbarTool[] {
  const byId = Object.fromEntries(TOOLBAR_TOOLS.map((t) => [t.id, t]))
  return order.map((id) => byId[id]).filter(Boolean)
}
