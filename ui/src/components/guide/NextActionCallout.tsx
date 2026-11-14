import { ArrowRight, Hourglass, Lightbulb, TriangleAlert } from 'lucide-react'
import { SafeLink } from './SafeLink'
import { t } from '@/lib/i18n/core'
import { cn } from '@/lib/utils'

export interface NextAction {
  /** Translated headline, e.g. "Chờ xác nhận trả ngay". */
  title: string
  /** Translated explanation of what must happen next. */
  description?: string
  /** Deep link to the page that performs the next step. */
  to?: string
  /** Translated link/button text; defaults to "Mở". */
  actionLabel?: string
  /** In-page action instead of (or besides) a link. */
  onAction?: () => void
  /** Translated role that must act when the user cannot (no permission). */
  waitingFor?: string
  tone?: 'info' | 'warning'
}

/**
 * "Việc cần làm tiếp" box on a document detail: one sentence and a direct
 * shortcut to the next step. Without permission it names who must act.
 */
export function NextActionCallout({
  action,
  className,
}: {
  action: NextAction | null
  className?: string
}) {
  if (!action) return null
  const tone = action.tone ?? 'info'
  const Icon = action.waitingFor
    ? Hourglass
    : tone === 'warning'
      ? TriangleAlert
      : Lightbulb
  const label = action.actionLabel ?? t('Mở')
  return (
    <section
      aria-label={t('Việc cần làm tiếp')}
      data-testid="next-action"
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center',
        tone === 'warning'
          ? 'border-warning/40 bg-warning/8'
          : 'border-primary/30 bg-primary/5',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5',
          tone === 'warning'
            ? 'bg-warning/15 text-warning'
            : 'bg-primary/12 text-primary',
        )}
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('Việc cần làm tiếp')}
        </p>
        <p className="text-sm font-semibold text-foreground">{action.title}</p>
        {action.description && (
          <p className="text-[13px] text-muted-foreground">
            {action.description}
          </p>
        )}
        {action.waitingFor && (
          <p className="text-[13px] font-medium text-foreground">
            {t('Chờ {role} thực hiện.', { role: action.waitingFor })}
          </p>
        )}
      </div>
      {!action.waitingFor && (action.to || action.onAction) && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {action.to ? (
            <SafeLink
              to={action.to}
              onClick={action.onAction}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </SafeLink>
          ) : (
            <button
              type="button"
              onClick={action.onAction}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  )
}
