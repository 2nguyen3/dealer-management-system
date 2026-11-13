import { createElement, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PageIconContext } from './pageIconContext'

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  eyebrow?: string
  actions?: ReactNode
  /** Title icon; defaults to the route's navigation icon, `false` hides it. */
  icon?: ReactNode | false
  className?: string
}

/** Page title row: icon tile + heading + one-line helper on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  icon,
  className,
}: PageHeaderProps) {
  const RouteIcon = useContext(PageIconContext)
  const tile =
    icon === false
      ? null
      : (icon ?? (RouteIcon ? createElement(RouteIcon) : null))
  return (
    <div
      className={cn(
        'mb-6 flex animate-in flex-col gap-3 duration-500 fade-in-0 slide-in-from-left-2 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {tile && (
          <span
            aria-hidden="true"
            data-testid="page-header-icon"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-chart-2/15 text-primary ring-1 ring-primary/10 [&_svg]:size-5"
          >
            {tile}
          </span>
        )}
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
            <p
              className="line-clamp-1 max-w-2xl text-xs text-muted-foreground"
              title={typeof description === 'string' ? description : undefined}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
