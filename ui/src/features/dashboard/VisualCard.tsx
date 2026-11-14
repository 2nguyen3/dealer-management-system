import { RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { ChartCard } from '../../components/blocks/ChartCard'
import { SortableHeader } from '../../components/data/SortControls'
import { sortRows, useSort } from '../../components/data/sorting'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Table } from '../../components/ui/Table'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n/core'

/**
 * One dashboard visual with its own loading/error lifecycle, so a failing
 * source degrades only this card.
 */
export function VisualCard({
  title,
  description,
  loading,
  error,
  onRetry,
  table,
  isEmpty,
  empty,
  className,
  footer,
  children,
}: {
  title: string
  description?: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  table?: ReactNode
  isEmpty?: boolean
  empty?: ReactNode
  className?: string
  footer?: ReactNode
  children: ReactNode
}) {
  const settled = !loading && !error
  return (
    <ChartCard
      title={title}
      description={description}
      className={cn(
        'h-full transition-shadow duration-300 hover:shadow-md',
        className,
      )}
      table={settled && !isEmpty ? table : undefined}
      isEmpty={settled && isEmpty}
      empty={empty}
      footer={settled ? footer : undefined}
    >
      {loading ? (
        <div className="flex h-40 items-end gap-2 py-2" aria-busy="true">
          <span className="sr-only">
            {t('Đang tải {title}…', { title: title.toLowerCase() })}
          </span>
          {[0.55, 0.8, 0.4, 0.95, 0.65, 0.3, 0.75].map((height, index) => (
            <Skeleton
              key={index}
              className="flex-1 rounded-full"
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
      ) : error ? (
        <Alert
          type="error"
          title={t('Không tải được {title}', { title: title.toLowerCase() })}
        >
          <span className="block">{error}</span>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              icon={<RotateCw className="size-3.5" aria-hidden="true" />}
              onClick={onRetry}
            >
              {t('Thử lại')}
            </Button>
          )}
        </Alert>
      ) : (
        children
      )}
    </ChartCard>
  )
}

export interface MiniTableRow {
  key: string
  label: string
  detail?: string
  cells: string[]
  /** Raw numbers aligned with `cells`; enables client-side column sorting. */
  values?: number[]
  selected?: boolean
  onSelect?: () => void
  selectLabel?: string
}

/**
 * Accessible table view for a chart; entity rows can cross-filter. The rows
 * are fully loaded, so headers sort client-side (asc → desc → original order).
 */
export function MiniTable({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: string[]
  rows: MiniTableRow[]
}) {
  const { sort, toggle } = useSort()
  const sortable = rows.length > 1 && rows.every((row) => row.values)
  const accessors: Record<string, (row: MiniTableRow) => string | number> = {
    c0: (row) => row.label,
  }
  headers.slice(1).forEach((_, index) => {
    accessors[`c${index + 1}`] = (row) => row.values?.[index] ?? 0
  })
  const ordered = sortable ? sortRows(rows, sort, accessors) : rows
  return (
    <Table caption={caption}>
      <thead className="sticky top-0 z-[1]">
        <tr>
          {headers.map((header, index) =>
            sortable ? (
              <SortableHeader
                key={header}
                field={`c${index}`}
                sort={sort}
                onSort={toggle}
                align={index ? 'right' : 'left'}
                firstDirection={index ? 'desc' : 'asc'}
                className={index ? undefined : 'text-start'}
              >
                {header}
              </SortableHeader>
            ) : (
              <th
                key={header}
                scope="col"
                className={index ? 'cell-number' : 'text-start'}
              >
                {header}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {ordered.map((row) => (
          <tr key={row.key} className={cn(row.selected && 'bg-accent')}>
            <th scope="row" className="px-3 py-2 text-start font-normal">
              {row.onSelect ? (
                <button
                  type="button"
                  onClick={row.onSelect}
                  aria-pressed={!!row.selected}
                  aria-label={row.selectLabel}
                  className="rounded-sm text-start font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {row.label}
                </button>
              ) : (
                <span className="font-medium">{row.label}</span>
              )}
              {row.detail && (
                <span className="block text-xs text-muted-foreground">
                  {row.detail}
                </span>
              )}
            </th>
            {row.cells.map((cell, index) => (
              <td key={index} className="cell-number tabular-nums">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
