import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageOff } from 'lucide-react'

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string
  alt?: string
}

const Img: React.FC<ImgProps> = ({ src, alt, ...props }) => {
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  if (!src || failed) {
    return (
      <div className="md-img-fail" role="img" aria-label={alt || '图片加载失败'}>
        <ImageOff className="mr-2 size-4" aria-hidden />
        图片加载失败
      </div>
    )
  }

  return (
    <>
      <img
        {...props}
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        className="md-img"
        onError={() => setFailed(true)}
        onClick={() => setZoom(true)}
      />
      {zoom &&
        createPortal(
          <div
            className="md-img-overlay"
            role="dialog"
            aria-label="图片预览"
            onClick={() => setZoom(false)}
          >
            <img src={src} alt={alt ?? ''} onClick={(e) => e.stopPropagation()} />
          </div>,
          document.body
        )}
    </>
  )
}

export default Img
