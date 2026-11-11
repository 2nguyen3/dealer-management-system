import { useState } from 'react'
import { SortableHeader } from '../../components/data/SortControls'
import { nextSort, type SortValue } from '../../components/data/sorting'
import { Table } from '../../components/ui/Table'
import { formatQuantity, formatVND } from '../../lib/formatters'
import { cn } from '@/lib/utils'
import type { ReportRow } from '../reports/contracts'
import {
  columnScale,
  matrixColumns,
  sortMatrix,
  type MatrixColumn,
  type MatrixRow,
} from './model'

function display(kind: 'money' | 'count', value: string | undefined) {
  if (value === undefined) return '—'
  return kind === 'money' ? formatVND(value) : formatQuantity(value)
}

/**
 * Agency × metric matrix with single-hue data bars per column (conditional
 * formatting). Clicking an agency cross-filters the dashboard.
 */
export function AgencyMatrix({
  rows,
  sources,
  totals,
  selectedId,
  onSelect,
}: {
  rows: MatrixRow[]
  sources: { sales: boolean; debt: boolean }
  totals: { sales?: ReportRow; debt?: ReportRow }
  selectedId: string | null
  onSelect: (row: MatrixRow) => void
}) {
  const columns = matrixColumns.filter((column) => sources[column.source])
  const fallback: MatrixColumn = columns[0]?.key ?? 'netSalesAmount'
  // Client-side order of the fully loaded agency rows; default: first column ↓.
  const [sort, setSort] = useState<SortValue>(`-${fallback}`)
  const field = sort.replace(/^-/, '')
  const sortKey = columns.some((column) => column.key === field)
    ? (field as MatrixColumn)
    : fallback
  const current: SortValue = sortKey === field ? sort : `-${fallback}`
  const desc = current.startsWith('-')
  const sorted = sortMatrix(rows, sortKey, desc)
  const scales = Object.fromEntries(
    columns.map((column) => [column.key, columnScale(rows, column.key)]),
  ) as Record<MatrixColumn, (value: string | undefined) => number>

  return (
    <Table caption="Ma trận đại lý theo chỉ số" className="min-w-[760px]">
      <thead className="sticky top-0 z-[1]">
        <tr>
          <th scope="col" className="text-left">
            Đại lý
          </th>
          {columns.map((column) => (
            <SortableHeader
              key={column.key}
              field={column.key}
              sort={current}
              align="right"
              firstDirection="desc"
              onSort={(key, first) =>
                setSort(nextSort(current, key, first) || `-${fallback}`)
              }
            >
              {column.label}
            </SortableHeader>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => {
          const selected = row.agencyId === selectedId
          return (
            <tr
              key={row.agencyId}
              aria-selected={selected || undefined}
              className={cn(
                selected && 'bg-accent',
                selectedId && !selected && 'opacity-55',
              )}
            >
              <th
                scope="row"
                className="min-w-44 px-3 py-2 text-left font-normal"
              >
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  aria-pressed={selected}
                  aria-label={`Lọc theo đại lý ${row.agencyCode} — ${row.agencyName}`}
                  className="grid rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="font-medium text-foreground hover:underline">
                    {row.agencyName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.agencyCode}
                  </span>
                </button>
              </th>
              {columns.map((column) => {
                const value = row.values[column.key]
                const ratio = scales[column.key](value)
                return (
                  <td key={column.key} className="cell-number relative">
                    <span
                      className="absolute inset-y-2 left-1 rounded-full bg-gradient-to-r from-chart-1/25 to-chart-2/20 transition-[width] duration-500"
                      style={{ width: `calc(${ratio * 100}% - 8px)` }}
                      aria-hidden="true"
                    />
                    <span className="relative tabular-nums">
                      {display(column.kind, value)}
                    </span>
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
      {(totals.sales || totals.debt) && (
        <tfoot>
          <tr className="border-t-2 bg-muted/40 font-semibold">
            <th scope="row" className="px-3 py-2.5 text-left">
              Tổng cộng
            </th>
            {columns.map((column) => {
              const source =
                column.source === 'sales' ? totals.sales : totals.debt
              const value =
                source?.[column.key] === undefined
                  ? undefined
                  : String(source[column.key])
              return (
                <td
                  key={column.key}
                  className="cell-number px-3 py-2.5 tabular-nums"
                >
                  {display(column.kind, value)}
                </td>
              )
            })}
          </tr>
        </tfoot>
      )}
    </Table>
  )
}
