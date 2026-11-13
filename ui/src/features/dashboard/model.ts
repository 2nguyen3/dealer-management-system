// Pure dashboard helpers: month arithmetic, slicer state, report queries and
// the agency matrix projection. Exact server strings are kept for display;
// numbers are derived only for chart geometry and comparisons.
import { percentChange, toNumber } from '../../lib/chart'
import {
  reports,
  type ReportKind,
  type ReportPage,
  type ReportQuery,
  type ReportRow,
} from '../reports/contracts'
import type { Dashboard } from './contracts'

export const MONTH_CHOICES = 24

/** 'YYYY-MM' → 'MM/YYYY' (pure string handling, no time zone involved). */
export function monthLabel(value: string): string {
  const [year, mm] = value.split('-')
  return `${mm}/${year}`
}

/** 'YYYY-MM' → 'MM/YY' for compact chart axis labels. */
export function shortMonthLabel(value: string): string {
  const [year = '', mm] = value.split('-')
  return `${mm}/${year.slice(-2)}`
}

function monthIndex(value: string): number {
  const [year = 0, mm = 1] = value.split('-').map(Number)
  return year * 12 + (mm - 1)
}

function fromIndex(index: number): string {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Calendar month `offset` months after `value`. */
export function shiftMonth(value: string, offset: number): string {
  return fromIndex(monthIndex(value) + offset)
}

/** The latest `MONTH_CHOICES` months ending at `current`, newest first. */
export function monthChoices(current: string) {
  return Array.from({ length: MONTH_CHOICES }, (_, offset) => {
    const value = shiftMonth(current, -offset)
    return { value, label: `Tháng ${monthLabel(value)}` }
  })
}

/** Exclusive business-date interval `[first day, first day of next month)`. */
export function monthPeriod(value: string): {
  fromDate: string
  toDate: string
} {
  return { fromDate: `${value}-01`, toDate: `${shiftMonth(value, 1)}-01` }
}

// ---------------------------------------------------------------- slicers

export type FilterKey = 'agencyId' | 'typeId' | 'wardId' | 'productId'
export interface FilterValue {
  id: string
  label: string
}
export type Filters = Record<FilterKey, FilterValue | null>

export const emptyFilters: Filters = {
  agencyId: null,
  typeId: null,
  wardId: null,
  productId: null,
}

export const filterNames: Record<FilterKey, string> = {
  agencyId: 'Đại lý',
  typeId: 'Loại đại lý',
  wardId: 'Phường/xã',
  productId: 'Mặt hàng',
}

export function activeFilters(filters: Filters): [FilterKey, FilterValue][] {
  return (Object.keys(filterNames) as FilterKey[]).flatMap((key) => {
    const value = filters[key]
    return value ? [[key, value] as [FilterKey, FilterValue]] : []
  })
}

/**
 * Each report visual's request. Agency/product selections that the visual
 * itself plots are highlighted client-side (Power BI cross-highlight) rather
 * than sent as a server filter, so the other entities stay visible but dimmed.
 */
export const reportPlan: Record<
  ReportKind,
  { sort: string; limit: string; server: FilterKey[] }
> = {
  sales: { sort: '-netSalesAmount', limit: '100', server: ['typeId'] },
  debt: {
    sort: '-closingDebt',
    limit: '100',
    server: ['typeId', 'wardId'],
  },
  'product-sales': { sort: '-salesAmount', limit: '10', server: ['agencyId'] },
  'cash-and-credit': {
    sort: '-cashReceived',
    limit: '100',
    server: ['agencyId'],
  },
  inventory: { sort: 'closingStock', limit: '8', server: [] },
}

/** Filters a visual reacts to: server filters plus its highlighted entity. */
export function visualFilters(kind: ReportKind): FilterKey[] {
  const highlight: FilterKey[] =
    kind === 'sales' || kind === 'debt'
      ? ['agencyId']
      : kind === 'product-sales' || kind === 'inventory'
        ? ['productId']
        : []
  return [...reportPlan[kind].server, ...highlight]
}

export function buildReportQuery(
  kind: ReportKind,
  selectedMonth: string,
  filters: Filters,
  overrides: Partial<Record<FilterKey, string>> = {},
  limit = reportPlan[kind].limit,
): ReportQuery {
  const query: Record<string, string> = {}
  for (const key of reportPlan[kind].server) {
    const value = filters[key]?.id
    if (value) query[key] = value
  }
  for (const [key, value] of Object.entries(overrides))
    if (value && reports[kind].filters.includes(key)) query[key] = value
  return {
    kind,
    ...monthPeriod(selectedMonth),
    filters: query,
    sort: reportPlan[kind].sort,
    limit,
  }
}

// ---------------------------------------------------------------- KPIs

export type TrendPoint = NonNullable<Dashboard['sales']>['monthlyTrend'][number]

/**
 * Month-over-month change of `field` for the selected month, using the
 * server trend. `null` when either month is missing or the base is zero.
 */
export function trendDelta(
  points: TrendPoint[],
  selectedMonth: string,
  field: 'gross' | 'returns' | 'net',
): number | null {
  const current = points.find((point) => point.month === selectedMonth)
  const previous = points.find(
    (point) => point.month === shiftMonth(selectedMonth, -1),
  )
  if (!current || !previous) return null
  return percentChange(toNumber(current[field]), toNumber(previous[field]))
}

// ---------------------------------------------------------------- matrix

export interface MatrixRow {
  agencyId: string
  agencyCode: string
  agencyName: string
  values: Partial<Record<MatrixColumn, string>>
}

export type MatrixColumn =
  | 'netSalesAmount'
  | 'returnAmount'
  | 'numberOfIssues'
  | 'debtIncrease'
  | 'debtDecrease'
  | 'closingDebt'

export const matrixColumns: {
  key: MatrixColumn
  label: string
  source: 'sales' | 'debt'
  kind: 'money' | 'count'
}[] = [
  {
    key: 'netSalesAmount',
    label: 'Doanh số thuần',
    source: 'sales',
    kind: 'money',
  },
  {
    key: 'returnAmount',
    label: 'Hàng trả lại',
    source: 'sales',
    kind: 'money',
  },
  {
    key: 'numberOfIssues',
    label: 'Số phiếu xuất',
    source: 'sales',
    kind: 'count',
  },
  { key: 'debtIncrease', label: 'Phát sinh nợ', source: 'debt', kind: 'money' },
  { key: 'debtDecrease', label: 'Giảm nợ', source: 'debt', kind: 'money' },
  { key: 'closingDebt', label: 'Nợ cuối kỳ', source: 'debt', kind: 'money' },
]

/** Merges the sales and debt report rows into one agency × metric matrix. */
export function buildMatrix(
  sales: ReportPage | null,
  debt: ReportPage | null,
): MatrixRow[] {
  const rows = new Map<string, MatrixRow>()
  const add = (source: 'sales' | 'debt', items: ReportRow[]) => {
    for (const item of items) {
      const agencyId = String(item.agencyId)
      const row = rows.get(agencyId) ?? {
        agencyId,
        agencyCode: String(item.agencyCode),
        agencyName: String(item.agencyName),
        values: {},
      }
      for (const column of matrixColumns)
        if (column.source === source && item[column.key] !== undefined)
          row.values[column.key] = String(item[column.key])
      rows.set(agencyId, row)
    }
  }
  if (sales) add('sales', sales.items)
  if (debt) add('debt', debt.items)
  return [...rows.values()]
}

/** Ratio of |value| to the column maximum, for data bars (0…1). */
export function columnScale(
  rows: MatrixRow[],
  column: MatrixColumn,
): (value: string | undefined) => number {
  const max = Math.max(
    0,
    ...rows.map((row) => Math.abs(toNumber(row.values[column]))),
  )
  return (value) => (max ? Math.abs(toNumber(value)) / max : 0)
}

export function sortMatrix(
  rows: MatrixRow[],
  column: MatrixColumn,
  descending: boolean,
): MatrixRow[] {
  const sign = descending ? -1 : 1
  return [...rows].sort((a, b) => {
    const diff = toNumber(a.values[column]) - toNumber(b.values[column])
    return diff ? sign * diff : a.agencyCode.localeCompare(b.agencyCode, 'vi')
  })
}

type Row = { readonly [key: string]: unknown }

export function agencyLabel(row: Row): string {
  return `${String(row.agencyCode)} — ${String(row.agencyName)}`
}

export function productLabel(row: Row): string {
  return `${String(row.productCode)} — ${String(row.productName)}`
}
