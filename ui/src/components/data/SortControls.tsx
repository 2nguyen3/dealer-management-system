import {
  ArrowDownNarrowWide,
  ArrowDownWideNarrow,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { cn } from '@/lib/utils'
import { sortDirection, type SortValue } from './sorting'
import { t } from '@/lib/i18n/core'

/**
 * Sortable column header (shadcn data-table recipe): a ghost button with a
 * direction icon inside the `<th>`, which also carries `aria-sort`.
 */
export function SortableHeader({
  field,
  sort,
  onSort,
  children,
  align = 'left',
  firstDirection = 'asc',
  className,
}: {
  field: string
  sort: SortValue
  onSort: (field: string, firstDirection?: 'asc' | 'desc') => void
  children: ReactNode
  align?: 'left' | 'right'
  firstDirection?: 'asc' | 'desc'
  className?: string
}) {
  const direction = sortDirection(sort, field)
  const Icon =
    direction === 'asc'
      ? ArrowUp
      : direction === 'desc'
        ? ArrowDown
        : ArrowUpDown
  return (
    <th
      scope="col"
      aria-sort={
        direction === 'asc'
          ? 'ascending'
          : direction === 'desc'
            ? 'descending'
            : 'none'
      }
      className={cn(align === 'right' && 'cell-number', className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort(field, firstDirection)}
        className={cn(
          'h-7 gap-1 px-1.5 text-[length:inherit] font-semibold tracking-wider uppercase [&_svg]:size-3.5',
          align === 'right' ? '-me-1.5 ms-auto flex-row-reverse' : '-ms-1.5',
          direction ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        <Icon aria-hidden="true" className={cn(!direction && 'opacity-50')} />
      </Button>
    </th>
  )
}

export interface SortOption {
  field: string
  label: string
}

/** Compact "Sắp xếp" menu for card/grid views and narrow screens. */
export function SortMenu({
  options,
  sort,
  onChange,
  defaultLabel = t('Mặc định'),
  className,
}: {
  options: readonly SortOption[]
  sort: SortValue
  onChange: (sort: SortValue) => void
  defaultLabel?: string
  className?: string
}) {
  const field = sort.replace(/^-/, '')
  const descending = sort.startsWith('-')
  const active = options.find((option) => option.field === field)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          {descending ? (
            <ArrowDownWideNarrow className="size-4" />
          ) : (
            <ArrowDownNarrowWide className="size-4" />
          )}
          <span className="truncate">
            {active
              ? active.label
              : t('Sắp xếp: {defaultLabel}', { defaultLabel })}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>{t('Sắp xếp theo')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={active ? field : ''}
          onValueChange={(value) =>
            onChange(value ? (descending ? `-${value}` : value) : '')
          }
        >
          <DropdownMenuRadioItem value="">{defaultLabel}</DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.field} value={option.field}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('Thứ tự')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={descending ? 'desc' : 'asc'}
              onValueChange={(value) =>
                onChange(value === 'desc' ? `-${field}` : field)
              }
            >
              <DropdownMenuRadioItem value="asc">
                <ArrowUp className="size-4" /> {t('Tăng dần')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                <ArrowDown className="size-4" /> {t('Giảm dần')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
