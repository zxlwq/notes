import React, { useCallback } from 'react'
import { Link, LinkProps } from 'react-router-dom'

interface PreloadProps extends Omit<LinkProps, 'onMouseEnter'> {
  preloadComponent?: () => Promise<unknown>
  children: React.ReactNode
}

const Preload: React.FC<PreloadProps> = ({ preloadComponent, children, ...props }) => {
  const handleMouseEnter = useCallback(() => {
    if (preloadComponent) {
      preloadComponent()
    }
  }, [preloadComponent])

  return (
    <Link {...props} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  )
}

export default Preload
