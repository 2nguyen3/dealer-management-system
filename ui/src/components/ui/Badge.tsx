import type { HTMLAttributes, ReactNode } from 'react'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  children: ReactNode
}

export function Badge({
  children,
  variant = 'neutral',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span className={`badge badge--${variant} ${className}`.trim()} {...props}>
      {children}
    </span>
  )
}
