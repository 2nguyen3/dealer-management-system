// Pure projections of a report page into KPI and chart data. Exact server
// strings are kept for display; numbers are only used for plotting/ranking.
import { toNumber } from '../../lib/chart'
import type { ReportKind, ReportRow } from './contracts'
import { displayValue } from './display'

/** One plotted category (agency or product) with numeric values per key. */
export interface ChartDatum {
  id: string
  /** Short axis label. */
  label: string
  /** Full readable name for tooltips and table views. */
  name: string
  /** Exact formatted value per plotted key. */
  display: Record<string, string>
  /** Optional per-mark fill (composition charts). */
  fill?: string
  [key: string]: unknown
}

const agencyKinds = new Set<ReportKind>(['sales', 'debt', 'cash-and-credit'])

export function isAgencyReport(kind: ReportKind): boolean {
  return agencyKinds.has(kind)
}

export function truncate(value: string, max = 20): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/** Stable identity, short code label and readable name of a report row. */
export function rowIdentity(
  kind: ReportKind,
  row: ReportRow,
): { id: string; code: string; name: string } {
  if (isAgencyReport(kind))
    return {
      id: String(row.agencyId),
      code: String(row.agencyCode),
      name: String(row.agencyName),
    }
  return {
    id: String(row.productId),
    code: String(row.productCode),
    name: `${String(row.productName)} (${String(row.unitName)})`,
  }
}

function datum(
  kind: ReportKind,
  row: ReportRow,
  keys: string[],
  axis: 'code' | 'name',
): ChartDatum {
  const identity = rowIdentity(kind, row)
  const result: ChartDatum = {
    id: identity.id,
    label: axis === 'code' ? identity.code : truncate(identity.name),
    name: `${identity.code} — ${identity.name}`,
    display: {},
  }
  for (const key of keys) {
    result[key] = toNumber(row[key])
    result.display[key] = displayValue(key, row[key])
  }
  return result
}

/**
 * Top `limit` rows of the current page ranked by `measure` (descending).
 * `keys` are the plotted values; the first key is the ranking measure when
 * `measure` is omitted.
 */
export function rankRows(
  kind: ReportKind,
  items: ReportRow[],
  keys: string[],
  options: { measure?: string; limit?: number; axis?: 'code' | 'name' } = {},
): ChartDatum[] {
  const measure = options.measure ?? keys[0]!
  return [...items]
    .sort((a, b) => toNumber(b[measure]) - toNumber(a[measure]))
    .slice(0, options.limit ?? 10)
    .map((row) => datum(kind, row, keys, options.axis ?? 'name'))
}

/** True when no plotted value differs from zero (nothing to draw). */
export function allZero(data: ChartDatum[], keys: string[]): boolean {
  return data.every((d) => keys.every((key) => !d[key]))
}

export type FlowRole = 'balance' | 'increase' | 'decrease'

export const flowRoles: Record<FlowRole, { label: string; color: string }> = {
  balance: { label: 'Số dư', color: 'var(--chart-1)' },
  increase: { label: 'Tăng', color: 'var(--chart-2)' },
  decrease: { label: 'Giảm', color: 'var(--chart-3)' },
}

/** Balance/flow components taken from the full-filter totals. */
export function flowData(
  totals: ReportRow | undefined,
  steps: { key: string; label: string; role: FlowRole }[],
): ChartDatum[] {
  if (!totals) return []
  return steps.map(({ key, label, role }) => ({
    id: key,
    label,
    name: `${label} · ${flowRoles[role].label}`,
    value: toNumber(totals[key]),
    display: { value: displayValue(key, totals[key]) },
    fill: flowRoles[role].color,
  }))
}

export const debtFlow: { key: string; label: string; role: FlowRole }[] = [
  { key: 'openingDebt', label: 'Nợ đầu kỳ', role: 'balance' },
  { key: 'debtIncrease', label: 'Phát sinh nợ', role: 'increase' },
  { key: 'cashApplied', label: 'Thu tiền trừ nợ', role: 'decrease' },
  { key: 'returnsApplied', label: 'Trả hàng trừ nợ', role: 'decrease' },
  { key: 'creditApplied', label: 'Cấn trừ dư có', role: 'decrease' },
  { key: 'closingDebt', label: 'Nợ cuối kỳ', role: 'balance' },
]

export const creditFlow: { key: string; label: string; role: FlowRole }[] = [
  { key: 'openingCredit', label: 'Dư có đầu kỳ', role: 'balance' },
  { key: 'creditCreated', label: 'Dư có phát sinh', role: 'increase' },
  { key: 'creditApplied', label: 'Đã cấn trừ', role: 'decrease' },
  { key: 'creditRefunded', label: 'Đã hoàn', role: 'decrease' },
  { key: 'closingCredit', label: 'Dư có cuối kỳ', role: 'balance' },
]

/** Exact non-negative decimal string compare against zero. */
function isZero(value: unknown): boolean {
  return /^-?0(\.0+)?$/.test(String(value))
}

/** Product counts on the current inventory page (units differ per product). */
export function inventoryCounts(items: ReportRow[]) {
  return {
    products: items.length,
    moving: items.filter(
      (row) => !isZero(row.receiptQuantity) || !isZero(row.issueQuantity),
    ).length,
    outOfStock: items.filter((row) => isZero(row.closingStock)).length,
    adjusted: items.filter((row) => !isZero(row.adjustmentQuantity)).length,
  }
}

/** Return share of gross sales as an exact-enough ratio for a KPI hint. */
export function returnRatio(totals: ReportRow | undefined): number | null {
  if (!totals) return null
  const gross = toNumber(totals.salesAmount)
  return gross > 0 ? toNumber(totals.returnAmount) / gross : null
}
