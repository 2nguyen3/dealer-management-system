import { FilterX, Info, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge as ShadcnBadge } from '@/components/shadcn/badge'
import { Button as ShadcnButton } from '@/components/shadcn/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/shadcn/input-group'
import { Label } from '@/components/shadcn/label'
import { Skeleton } from '@/components/shadcn/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip'
import { FilterIcon } from '@/components/ui/FilterIcon'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n/core'

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
        <div className="flex flex-col gap-2.5 border-b px-3 py-2.5 sm:px-4 lg:flex-row lg:flex-wrap lg:items-end">
          {toolbar}
        </div>
      )}
      <div className="min-w-0 overflow-x-auto">{children}</div>
      {footer}
    </section>
  )
}

/** Search box: shadcn InputGroup with a leading search icon and a label. */
export function SearchField({
  id,
  label = t('Tìm kiếm'),
  value,
  onChange,
  placeholder = t('Nhập từ khóa…'),
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
      <InputGroup className="bg-card">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputGroup>
    </div>
  )
}

/** Single-choice segmented filter; the empty value means "all". */
export function ToggleFilter({
  label,
  value,
  onChange,
  options,
  allLabel = t('Tất cả'),
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  allLabel?: string
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-[13px] font-medium text-foreground/85">
        {label}
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={label}
        value={value || '__all'}
        onValueChange={(next) => onChange(next === '__all' ? '' : next)}
        className="h-9 bg-card"
      >
        <ToggleGroupItem value="__all" className="h-9 gap-1.5 text-xs">
          <FilterIcon value="" />
          {allLabel}
        </ToggleGroupItem>
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-9 gap-1.5 text-xs"
          >
            <FilterIcon value={option.value} />
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** Active filter count with a one-click reset; hidden when nothing is set. */
export function FilterReset({
  count,
  onReset,
}: {
  count: number
  onReset: () => void
}) {
  if (count <= 0) return null
  return (
    <ShadcnButton
      type="button"
      variant="ghost"
      size="sm"
      onClick={onReset}
      className="h-9 gap-1.5 text-muted-foreground hover:text-foreground lg:self-end"
    >
      <FilterX className="size-4" aria-hidden="true" />
      {t('Xóa lọc')}
      <ShadcnBadge
        variant="secondary"
        className="h-5 min-w-5 rounded-full px-1.5 tabular-nums"
        aria-label={t('{count} bộ lọc đang dùng', { count })}
      >
        {count}
      </ShadcnBadge>
    </ShadcnButton>
  )
}

/** Small "i" button whose tooltip carries the explanation instead of prose. */
export function InfoHint({
  label = t('Giải thích'),
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ShadcnButton
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="size-7 cursor-help text-muted-foreground hover:text-foreground"
          >
            <Info className="size-4" aria-hidden="true" />
          </ShadcnButton>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-pretty">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
      className="text-sm text-muted-foreground tabular-nums lg:ms-auto lg:self-center"
      aria-live="polite"
    >
      {loading ? (
        t('Đang tải…')
      ) : (
        <>
          <span className="font-semibold text-foreground">{count}</span>{' '}
          {t('kết quả trên trang')}
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
  label = t('Đang tải danh sách…'),
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
