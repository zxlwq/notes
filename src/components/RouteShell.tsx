/** 懒加载路由占位：保持与页面一致的背景，避免 chunk 加载时全屏 spinner 引起宽度跳变 */
export function RouteShell() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-100/60 to-gray-200/60"
      style={{
        backgroundImage: "var(--app-bg-image, url('/background.webp'))",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
      aria-hidden
    />
  )
}
