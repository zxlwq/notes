import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Loading from '@/components/ui/Loading'
import Md from '@/components/view/Md'
import { shareApi } from '@/lib/api'
import type { PublicShare } from '@/types'

const pageBgStyle = {
  backgroundImage: "var(--app-bg-image, url('/background.webp'))",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed' as const,
}

const SharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [share, setShare] = useState<PublicShare | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError('无效的分享链接')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await shareApi.get(token)
        if (!cancelled) {
          setShare(res.data)
          setError('')
        }
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number; data?: { error?: string } } })
          ?.response?.status
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        if (!cancelled) {
          if (status === 410) setError(msg || '分享已过期或已撤销')
          else if (status === 404) setError(msg || '分享不存在')
          else setError(msg || '加载失败')
          setShare(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-100/60 to-gray-200/60"
      style={pageBgStyle}
    >
      <header className="border-b border-white/30 bg-white/30 shadow-sm backdrop-blur-md">
        <div className="flex h-12 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="font-semibold text-gray-900">公开分享</span>
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            登录
          </Link>
        </div>
      </header>

      <main className="w-full">
        <div className="w-full px-4 pb-6 pt-4 sm:px-6 lg:px-8">
          {loading && (
            <div className="rounded-lg border border-white/40 bg-white/60 p-6 shadow backdrop-blur-md">
              <Loading inline size="md" text="加载分享内容..." />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-white/40 bg-white/60 p-6 text-center shadow backdrop-blur-md">
              <h1 className="mb-2 text-xl font-semibold text-gray-900">无法打开分享</h1>
              <p className="text-gray-700">{error}</p>
            </div>
          )}

          {!loading && share && (
            <div
              data-layout-card
              className="rounded-lg border border-white/40 bg-white/60 shadow backdrop-blur-md"
              style={{ wordBreak: 'break-word' }}
            >
              <div className="p-6" style={{ wordBreak: 'break-word' }}>
                <h1
                  className="mb-1 font-bold text-gray-900"
                  style={{ fontSize: '1.5rem' }}
                  data-note-title
                >
                  {share.title || '无标题'}
                </h1>
                <p className="mb-3 text-sm text-white/90">
                  分享于 {new Date(share.createdAt).toLocaleString('zh-CN')}
                  {share.expiresAt
                    ? ` · 有效至 ${new Date(share.expiresAt).toLocaleString('zh-CN')}`
                    : ' · 永久有效'}
                </p>
                {share.tags?.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {share.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <Md content={share.content || ''} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default SharePage
