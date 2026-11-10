import type { ReactNode } from 'react'
import { Card } from '@/components/shadcn/card'
import { Skeleton } from '@/components/shadcn/skeleton'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

/** One-row slicer bar above a list; wraps on narrow screens. */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="filter-bar"
      className={cn(
        'grid grid-cols-1 items-end gap-3 rounded-xl border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Card holding a data table; the table scrolls horizontally inside it. */
export function TableCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('gap-0 overflow-hidden py-0 shadow-xs', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </Card>
  )
}

/** Placeholder rows shown while a list loads. */
export function TableSkeleton({
  rows = 5,
  label = 'Đang tải dữ liệu...',
}: {
  rows?: number
  label?: string
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-6 w-full opacity-70" />
      ))}
    </div>
  )
}

/** Titled section card used inside detail views and pages. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-xl border bg-card p-4 shadow-xs', className)}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  )
}

/** Prominent summary block at the top of a document detail. */
export function DetailHeader({
  code,
  badge,
  amountLabel = 'Số tiền',
  amount,
  meta,
  icon,
  tone = 'neutral',
}: {
  code: ReactNode
  badge?: ReactNode
  amountLabel?: string
  amount?: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        tone === 'neutral' && 'bg-muted/40',
        tone === 'success' && 'border-emerald-200 bg-emerald-50/70',
        tone === 'warning' && 'border-amber-200 bg-amber-50/70',
        tone === 'danger' && 'border-red-200 bg-red-50/70',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-xs [&_svg]:size-5"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold tracking-tight break-all">
              {code}
            </span>
            {badge}
          </div>
          {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
        </div>
      </div>
      {amount !== undefined && (
        <div className="shrink-0 sm:text-right">
          <p className="text-xs font-medium text-muted-foreground">
            {amountLabel}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {amount}
          </p>
        </div>
      )}
    </div>
  )
}

/** Sticky-looking row of actions at the end of a detail view. */
export function ActionBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Confirmation step for a state-changing action. */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
  disabled,
  busy,
  children,
}: {
  isOpen: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
  disabled?: boolean
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Quay lại
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            disabled={disabled}
            isLoading={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Footer row of a form inside a modal. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 pt-2">{children}</div>
}
