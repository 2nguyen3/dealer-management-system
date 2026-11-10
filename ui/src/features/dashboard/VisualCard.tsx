import { RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { ChartCard } from '../../components/blocks/ChartCard'
import { Skeleton } from '../../components/shadcn/skeleton'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Table } from '../../components/ui/Table'
import { cn } from '@/lib/utils'

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
      className={cn('h-full', className)}
      table={settled && !isEmpty ? table : undefined}
      isEmpty={settled && isEmpty}
      empty={empty}
      footer={settled ? footer : undefined}
    >
      {loading ? (
        <div className="space-y-3 py-2" aria-busy="true">
          <span className="sr-only">Đang tải {title.toLowerCase()}…</span>
          {[0.92, 0.74, 0.6, 0.48, 0.32].map((width) => (
            <Skeleton
              key={width}
              className="h-5"
              style={{ width: `${width * 100}%` }}
            />
          ))}
        </div>
      ) : error ? (
        <Alert type="error" title={`Không tải được ${title.toLowerCase()}`}>
          <span className="block">{error}</span>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              icon={<RotateCw className="size-3.5" aria-hidden="true" />}
              onClick={onRetry}
            >
              Thử lại
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
  selected?: boolean
  onSelect?: () => void
  selectLabel?: string
}

/** Accessible table view for a chart; entity rows can cross-filter. */
export function MiniTable({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: string[]
  rows: MiniTableRow[]
}) {
  return (
    <Table caption={caption}>
      <thead className="sticky top-0 z-[1]">
        <tr>
          {headers.map((header, index) => (
            <th
              key={header}
              scope="col"
              className={index ? 'cell-number' : 'text-left'}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className={cn(row.selected && 'bg-accent')}>
            <th scope="row" className="px-3 py-2 text-left font-normal">
              {row.onSelect ? (
                <button
                  type="button"
                  onClick={row.onSelect}
                  aria-pressed={!!row.selected}
                  aria-label={row.selectLabel}
                  className="rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
