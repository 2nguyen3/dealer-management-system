import { Info, ListFilter, RotateCcw, type LucideIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge as ShadcnBadge } from '../../components/shadcn/badge'
import { Button as ShadcnButton } from '../../components/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/shadcn/card'
import { Skeleton } from '../../components/shadcn/skeleton'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../components/shadcn/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/shadcn/tooltip'

/** One labelled fact in a description grid. */
export function Fact({
  label,
  children,
  full = false,
  className,
}: {
  label: string
  children: ReactNode
  full?: boolean
  className?: string
}) {
  return (
    <div
      className={cn('min-w-0 space-y-1', full && 'col-span-full', className)}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-foreground">{children}</dd>
    </div>
  )
}

/** Responsive description grid for document/revision facts. */
export function FactGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </dl>
  )
}

/** Card section with a compact title row; content padding is configurable. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  as: Heading = 'h3',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <Card className={cn('gap-4 py-4 shadow-xs', className)}>
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-semibold">
          <Heading className="flex items-center gap-2">{title}</Heading>
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
        {actions && (
          <CardAction className="flex flex-wrap items-center gap-2">
            {actions}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className={cn('px-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

/** Muted inline guidance with an info icon. */
export function Hint({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground',
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** Placeholder rows shown while a table page loads. */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  label = 'Đang tải dữ liệu...',
}: {
  rows?: number
  columns?: number
  label?: string
}) {
  return (
    <div role="status" className="space-y-3 p-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4" aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={cn('h-4', column === 0 ? 'w-24' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export interface SegmentOption {
  value: string
  label: string
}

/**
 * Segmented single-choice filter (status tabs). Items are radios with an
 * accessible group label; choosing the active item again keeps it selected.
 */
export function SegmentedFilter({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string
  value: string
  options: readonly SegmentOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn('max-w-full overflow-x-auto', className)}>
      <ToggleGroup
        type="single"
        aria-label={label}
        value={value || '__all__'}
        disabled={disabled}
        onValueChange={(next) => {
          if (!next) return
          onChange(next === '__all__' ? '' : next)
        }}
        className="rounded-lg bg-muted p-[3px]"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value || '__all__'}
            value={option.value || '__all__'}
            className="h-8 cursor-pointer rounded-md! border-0 px-3 text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** Small "i" button whose tooltip carries the explanation instead of prose. */
export function InfoTip({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ShadcnButton
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className={cn('rounded-full text-muted-foreground', className)}
          >
            <Info aria-hidden="true" />
          </ShadcnButton>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Active-filter summary for a filter bar: a count pill and a reset action.
 * Renders nothing while no filter is active.
 */
export function FilterStatus({
  count,
  onReset,
  resetLabel = 'Xóa lọc',
}: {
  count: number
  onReset: () => void
  resetLabel?: string
}) {
  if (count <= 0) return null
  return (
    <span className="flex items-center gap-1.5">
      <ShadcnBadge
        variant="secondary"
        className="gap-1 tabular-nums"
        aria-label={`${count} bộ lọc đang áp dụng`}
      >
        <ListFilter aria-hidden="true" />
        {count}
      </ShadcnBadge>
      <ShadcnButton
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-muted-foreground"
        onClick={onReset}
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        {resetLabel}
      </ShadcnButton>
    </span>
  )
}

export interface LifecycleStep {
  key: string
  label: string
  icon: LucideIcon
  hint: string
}

/**
 * Compact lifecycle rail: steps before `current` are done, `current` is
 * highlighted (destructive when `tone` says so) and later steps stay muted.
 */
export function LifecycleSteps({
  steps,
  current,
  tone = 'primary',
  label = 'Vòng đời chứng từ',
  className,
}: {
  steps: readonly LifecycleStep[]
  current: number
  tone?: 'primary' | 'success' | 'destructive'
  label?: string
  className?: string
}) {
  const active = {
    primary: 'border-primary/40 bg-primary/10 text-primary',
    success: 'border-success/40 bg-success/10 text-success',
    destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
  }[tone]
  return (
    <TooltipProvider delayDuration={150}>
      <ol
        aria-label={label}
        className={cn('flex flex-wrap items-center gap-1', className)}
      >
        {steps.map((step, index) => {
          const done = index < current
          const isCurrent = index === current
          const Icon = step.icon
          return (
            <Fragment key={step.key}>
              {index > 0 && (
                <li
                  aria-hidden="true"
                  className={cn(
                    'h-px w-3 rounded-full sm:w-6',
                    index <= current ? 'bg-primary/50' : 'bg-border',
                  )}
                />
              )}
              <li aria-current={isCurrent ? 'step' : undefined}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ShadcnBadge
                      variant="outline"
                      tabIndex={0}
                      className={cn(
                        'h-6 cursor-default gap-1 px-2 font-medium transition-colors',
                        isCurrent && active,
                        done && 'border-transparent bg-muted text-foreground',
                        !done &&
                          !isCurrent &&
                          'border-dashed text-muted-foreground',
                      )}
                    >
                      <Icon aria-hidden="true" />
                      {step.label}
                    </ShadcnBadge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56 text-xs">
                    {step.hint}
                  </TooltipContent>
                </Tooltip>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </TooltipProvider>
  )
}
