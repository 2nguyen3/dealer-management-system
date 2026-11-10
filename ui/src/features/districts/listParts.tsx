import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button as ShadcnButton } from '@/components/shadcn/button'
import { Input as ShadcnInput } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { Skeleton } from '@/components/shadcn/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip'
import { cn } from '@/lib/utils'

/** Card shell shared by list pages: toolbar on top, table, footer. */
export function ListCard({
  toolbar,
  children,
  footer,
  className,
}: {
  toolbar?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('min-w-0 rounded-xl border bg-card shadow-xs', className)}
    >
      {toolbar && (
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:flex-wrap lg:items-end">
          {toolbar}
        </div>
      )}
      <div className="min-w-0 overflow-x-auto">{children}</div>
      {footer}
    </section>
  )
}

/** Search box with a leading icon and a visible label. */
export function SearchField({
  id,
  label = 'Tìm kiếm',
  value,
  onChange,
  placeholder = 'Nhập từ khóa…',
  className,
}: {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('form-field grid min-w-0 gap-1.5 lg:w-72', className)}>
      <Label htmlFor={id} className="text-[13px] text-foreground/85">
        {label}
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <ShadcnInput
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="bg-card pl-8"
        />
      </div>
    </div>
  )
}

/** Number of rows on the current page, announced politely. */
export function ResultCount({
  count,
  loading,
}: {
  count: number
  loading?: boolean
}) {
  return (
    <p
      className="text-sm text-muted-foreground tabular-nums lg:ml-auto lg:self-center"
      aria-live="polite"
    >
      {loading ? (
        'Đang tải…'
      ) : (
        <>
          <span className="font-semibold text-foreground">{count}</span> kết quả
          trên trang
        </>
      )}
    </p>
  )
}

/** Icon-only row action: accessible name from `label`, tooltip on hover/focus. */
export function IconAction({
  label,
  tooltip,
  onClick,
  disabled,
  tone = 'default',
  children,
}: {
  label: string
  tooltip?: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ShadcnButton
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              'cursor-pointer text-muted-foreground hover:text-foreground',
              tone === 'danger' &&
                'hover:bg-destructive/10 hover:text-destructive',
            )}
          >
            {children}
          </ShadcnButton>
        </TooltipTrigger>
        <TooltipContent>{tooltip ?? label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Placeholder rows while a list is loading. */
export function TableSkeleton({
  columns,
  rows = 6,
  label = 'Đang tải danh sách…',
}: {
  columns: number
  rows?: number
  label?: string
}) {
  return (
    <div role="status" aria-label={label} className="divide-y">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid gap-4 px-4 py-3"
          style={{
            gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={cn('h-4', column === 0 ? 'w-3/4' : 'w-1/2')}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export type DetailEntry = [label: string, value: ReactNode, wide?: boolean]

/** Label/value pairs of a record, two columns from the small breakpoint. */
export function DetailGrid({ entries }: { entries: DetailEntry[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
      {entries.map(([label, value, wide]) => (
        <div key={label} className={cn('min-w-0', wide && 'sm:col-span-2')}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm break-words text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
