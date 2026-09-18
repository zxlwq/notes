import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { PluggableList } from 'unified'
import { rehypeAssignTocIds } from './rehypeTocIds'

const detailSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'u'],
}

/** 详情页 Markdown 渲染：按 TOC 顺序注入标题 id */
export function createDetailRehypePlugins(tocItems: { id: string }[]): PluggableList {
  return [
    rehypeRaw,
    [rehypeSanitize, detailSanitizeSchema],
    rehypeHighlight,
    rehypeAssignTocIds(tocItems),
  ]
}
