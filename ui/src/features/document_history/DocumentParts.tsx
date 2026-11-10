import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
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
