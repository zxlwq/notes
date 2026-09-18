import React, { useEffect, useState, useCallback } from 'react'

interface BackToTopProps {
  threshold?: number
}

const BackToTop: React.FC<BackToTopProps> = ({ threshold = 200 }) => {
  const [visible, setVisible] = useState(false)

  const handleScroll = useCallback(() => {
    const scrollTop =
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
    setVisible(scrollTop > threshold)
  }, [threshold])

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
  }

  useEffect(() => {
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  if (!visible) return null

  return (
    <button
      onClick={scrollToTop}
      aria-label="返回顶部"
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 9999,
        background: 'rgba(59, 130, 246, 0.95)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '9999px',
        width: '64px',
        height: '64px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.5)'
        e.currentTarget.style.background = 'rgba(37, 99, 235, 0.98)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.4)'
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.95)'
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="36"
        height="36"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M12 5l-6 6M12 5l6 6" />
      </svg>
    </button>
  )
}

export default BackToTop
