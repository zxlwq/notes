import React from 'react'

interface LoadingProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
  /** 内联模式，不使用 min-h-screen，避免嵌入内容区时布局跳动 */
  inline?: boolean
}

const Loading: React.FC<LoadingProps> = ({ text = '加载中...', size = 'lg', inline = false }) => {
  const sizeClasses: Record<string, string> = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div
      className={
        inline
          ? 'flex items-center justify-center py-16'
          : 'flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100/60 to-gray-200/60'
      }
    >
      <div className="text-center">
        <div
          className={`mx-auto animate-spin rounded-full border-b-2 border-primary-500 ${sizeClasses[size]}`}
        ></div>
        <div className="mt-4 text-sm text-gray-500">{text}</div>
        {!inline && <div className="mt-2 text-xs text-gray-400">请稍候，正在为您准备内容...</div>}
      </div>
    </div>
  )
}

export default Loading
