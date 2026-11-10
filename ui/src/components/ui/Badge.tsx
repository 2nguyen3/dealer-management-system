import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge as ShadcnBadge } from '../shadcn/badge'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  children: ReactNode
}

const TONES: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  neutral: 'border-border bg-muted text-muted-foreground',
}

const DOTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
  info: 'bg-sky-600',
  neutral: 'bg-slate-400',
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
