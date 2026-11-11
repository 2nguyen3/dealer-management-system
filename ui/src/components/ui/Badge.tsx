import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge as ShadcnBadge } from '../shadcn/badge'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  children: ReactNode
}

const TONES: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'border-success/25 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
  info: 'border-info/25 bg-info/10 text-info',
  neutral: 'border-border bg-muted text-muted-foreground',
}

const DOTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info animate-pulse',
  neutral: 'bg-muted-foreground/60',
}

/** Status pill. `badge badge--<tone>` stay as stable markers for tests. */
export function Badge({
  children,
  variant = 'neutral',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn(
        'badge',
        `badge--${variant}`,
        'gap-1.5 rounded-full px-2 py-0.5 font-medium',
        TONES[variant],
        className,
      )}
      {...props}
    >
      <span
        className={cn('size-1.5 rounded-full', DOTS[variant])}
        aria-hidden="true"
      />
      {children}
    </ShadcnBadge>
  )
}
