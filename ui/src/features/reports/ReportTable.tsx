import { SortableHeader } from '../../components/data/SortControls'
import type { SortValue } from '../../components/data/sorting'
import { toNumber } from '../../lib/chart'
import { cn } from '@/lib/utils'
import { reports, type ReportKind, type ReportPage } from './contracts'
import {
  columnLabels,
  displayValue,
  isNumeric,
  sortableColumns,
  visibleColumns,
} from './display'

const HEAD =
  'sticky top-0 z-10 h-10 border-b bg-muted px-3 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground'

/**
 * Detailed report rows: sticky header, tabular numbers, full-filter totals.
 * Sortable headers request a new server order (the rows are paginated); the
 * sortable measures get in-cell data bars scaled to the page maximum.
 */
export function ReportTable({
  kind,
  page,
  sort,
  onSort,
}: {
  kind: ReportKind
  page: ReportPage
  /** Applied server sort, e.g. `-salesAmount`. */
  sort?: SortValue
  onSort?: (field: string, firstDirection?: 'asc' | 'desc') => void
}) {
  const columns = visibleColumns(kind)
  const totals = page.totals
  const firstText = columns.findIndex((col) => !isNumeric(col))
  const sortable = onSort ? sortableColumns(kind) : new Set<string>()
  const scales = Object.fromEntries(
    [...sortable].map((col) => [
      col,
      Math.max(0, ...page.items.map((row) => Math.abs(toNumber(row[col])))),
    ]),
  ) as Record<string, number>
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border">
      <table className="w-full caption-bottom text-[13px]">
        <caption className="sr-only">{reports[kind].label}</caption>
        <thead>
          <tr>
            {columns.map((col) =>
              sortable.has(col) && onSort ? (
                <SortableHeader
                  key={col}
                  field={col}
                  sort={sort ?? ''}
                  onSort={onSort}
                  align="right"
                  firstDirection="desc"
                  className={cn(HEAD, 'text-right')}
                >
                  {columnLabels[col] ?? col}
                </SortableHeader>
              ) : (
                <th
                  scope="col"
                  key={col}
                  className={cn(
                    HEAD,
                    isNumeric(col) && 'cell-number text-right',
                  )}
                >
                  {columnLabels[col] ?? col}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {page.items.map((row) => (
            <tr
              key={String(row.agencyId ?? row.productId)}
              className="border-b transition-colors last:border-0 hover:bg-muted/40"
            >
              {columns.map((col) => {
                const max = scales[col]
                return (
                  <td
                    key={col}
                    className={cn(
                      'px-3 py-2.5 align-middle',
                      isNumeric(col)
                        ? 'cell-number text-right tabular-nums'
                        : 'max-w-64 truncate',
                      max !== undefined && 'relative isolate',
                    )}
                  >
                    {max ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 right-1 -z-10 rounded-full bg-gradient-to-l from-chart-1/20 to-chart-2/10"
                        style={{
                          width: `calc(${(Math.abs(toNumber(row[col])) / max) * 100}% - 8px)`,
                        }}
                      />
                    ) : null}
                    {displayValue(col, row[col])}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="font-semibold">
              {columns.map((col, index) => (
                <td
                  key={col}
                  className={cn(
                    'sticky bottom-0 border-t bg-muted px-3 py-2.5 whitespace-nowrap',
                    isNumeric(col) && 'cell-number text-right tabular-nums',
                  )}
                >
                  {index === firstText
                    ? 'Tổng toàn bộ kết quả đã lọc'
                    : col in totals
                      ? displayValue(col, totals[col])
                      : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
