import React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'secondary-outline' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const globalFontSize = 'var(--global-font-size, 14px)'

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    'secondary-outline':
      'border-2 border-transparent bg-transparent text-gray-700 hover:border-green-500 hover:bg-transparent focus:ring-green-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
    lg: 'px-6 py-3',
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading || variant === 'secondary-outline') return

    const button = e.currentTarget

    switch (variant) {
      case 'primary':
        button.style.backgroundColor = '#1d4ed8'
        break
      case 'secondary':
        button.style.backgroundColor = '#f3f4f6'
        break
      case 'danger':
        button.style.backgroundColor = '#dc2626'
        break
      case 'success':
        button.style.backgroundColor = '#16a34a'
        break
      case 'ghost':
        button.style.backgroundColor = '#f3f4f6'
        break
    }
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading || variant === 'secondary-outline') return

    const button = e.currentTarget

    switch (variant) {
      case 'primary':
        button.style.backgroundColor = '#2563eb'
        break
      case 'secondary':
        button.style.backgroundColor = 'transparent'
        break
      case 'danger':
        button.style.backgroundColor = '#dc2626'
        break
      case 'success':
        button.style.backgroundColor = '#16a34a'
        break
      case 'ghost':
        button.style.backgroundColor = 'transparent'
        break
    }
  }

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      style={{
        fontSize: globalFontSize,
        transition: 'none',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="mr-2 size-4 animate-spin rounded-full border-b-2 border-current"></div>
      )}
      {children}
    </button>
  )
}

export default Button
