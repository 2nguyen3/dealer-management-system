import { cn } from '@/lib/utils'
import { reports, type ReportKind, type ReportPage } from './contracts'
import {
  columnLabels,
  displayValue,
  isNumeric,
  visibleColumns,
} from './display'

/** Detailed report rows: sticky header, tabular numbers, full-filter totals. */
export function ReportTable({
  kind,
  page,
}: {
  kind: ReportKind
  page: ReportPage
}) {
  const columns = visibleColumns(kind)
  const totals = page.totals
  const firstText = columns.findIndex((col) => !isNumeric(col))
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border">
      <table className="w-full caption-bottom text-[13px]">
        <caption className="sr-only">{reports[kind].label}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                scope="col"
                key={col}
                className={cn(
                  'sticky top-0 z-10 h-10 border-b bg-muted px-3 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground',
                  isNumeric(col) && 'cell-number text-right',
                )}
              >
                {columnLabels[col] ?? col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.items.map((row) => (
            <tr
              key={String(row.agencyId ?? row.productId)}
              className="border-b transition-colors last:border-0 hover:bg-muted/40"
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className={cn(
                    'px-3 py-2.5 align-middle',
                    isNumeric(col)
                      ? 'cell-number text-right tabular-nums'
                      : 'max-w-64 truncate',
                  )}
                >
                  {displayValue(col, row[col])}
                </td>
              ))}
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
