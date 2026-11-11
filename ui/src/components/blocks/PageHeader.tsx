import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  eyebrow?: string
  actions?: ReactNode
  className?: string
}

/** Page title row: heading + supporting text on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex animate-in flex-col gap-3 duration-500 fade-in-0 slide-in-from-left-2 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.18em] text-primary uppercase">
            <span className="h-px w-4 bg-primary/60" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-[1.6rem] leading-tight font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="line-clamp-1 max-w-2xl text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
