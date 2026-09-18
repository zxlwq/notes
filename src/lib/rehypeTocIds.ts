import type { Nodes, Root } from 'hast'
import type { Plugin } from 'unified'

function assignHeadingIds(node: Nodes, tocItems: { id: string }[], state: { index: number }) {
  if (node.type !== 'element') return
  if (/^h[1-6]$/.test(node.tagName)) {
    const item = tocItems[state.index]
    if (item) {
      node.properties = node.properties || {}
      node.properties.id = item.id
      state.index += 1
    }
  }
  for (const child of node.children) {
    assignHeadingIds(child, tocItems, state)
  }
}

/** 在 rehype 阶段按文档顺序注入 TOC id（仅运行一次，避免 React Strict Mode 下 render 副作用错位） */
export function rehypeAssignTocIds(tocItems: { id: string }[]): Plugin<[], Root> {
  return function attach() {
    return (tree: Root) => {
      const state = { index: 0 }
      for (const child of tree.children) {
        assignHeadingIds(child, tocItems, state)
      }
    }
  }
}
