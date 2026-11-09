import type { HTMLAttributes, ReactNode } from 'react'
import { Badge as ShadcnBadge } from '../shadcn/badge'

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
    <ShadcnBadge
      variant={variant === 'danger' ? 'destructive' : 'secondary'}
      className={`badge badge--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </ShadcnBadge>
  )
}
