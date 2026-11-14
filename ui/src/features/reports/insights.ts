// Pure projections of a report page into KPI and chart data. Exact server
// strings are kept for display; numbers are only used for plotting/ranking.
import { formatCompactVND, formatPlain, toNumber } from '../../lib/chart'
import { formatDate, formatVND } from '../../lib/formatters'
import type { ReportKind, ReportRow } from './contracts'
import { displayValue } from './display'
import { t } from '@/lib/i18n/core'

/** One plotted category (agency, product or day) with numeric values per key. */
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

const agencyKinds = new Set<ReportKind>(['sales', 'debt'])

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
  if (kind === 'collections') {
    const date = String(row.businessDate)
    const name = formatDate(date)
    return { id: date, code: name.slice(0, 5), name }
  }
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
    name:
      kind === 'collections'
        ? identity.name
        : `${identity.code} — ${identity.name}`,
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

/**
 * Rows of a dated report (collections) in chronological order: the last
 * `limit` days of the page, labelled dd/MM.
 */
export function timelineRows(
  kind: ReportKind,
  items: ReportRow[],
  keys: string[],
  limit = 31,
): ChartDatum[] {
  return [...items]
    .sort((a, b) =>
      String(a.businessDate).localeCompare(String(b.businessDate)),
    )
    .slice(-limit)
    .map((row) => datum(kind, row, keys, 'code'))
}

/** True when no plotted value differs from zero (nothing to draw). */
export function allZero(data: ChartDatum[], keys: string[]): boolean {
  return data.every((d) => keys.every((key) => !d[key]))
}

export type FlowRole = 'balance' | 'increase' | 'decrease'

export const flowRoles: Record<FlowRole, { label: string; color: string }> = {
  balance: { label: t('Số dư'), color: 'var(--chart-1)' },
  increase: { label: t('Tăng'), color: 'var(--chart-2)' },
  decrease: { label: t('Giảm'), color: 'var(--chart-3)' },
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

/** Opening debt + increase − paid = closing debt (BM6.2). */
export const debtFlow: { key: string; label: string; role: FlowRole }[] = [
  { key: 'openingDebt', label: t('Nợ đầu kỳ'), role: 'balance' },
  { key: 'debtIncrease', label: t('Phát sinh nợ'), role: 'increase' },
  { key: 'paidAmount', label: t('Đã thu'), role: 'decrease' },
  { key: 'closingDebt', label: t('Nợ cuối kỳ'), role: 'balance' },
]

/** Exact decimal string compare against zero. */
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
    issued: items.filter((row) => !isZero(row.issueQuantity)).length,
    outOfStock: items.filter(
      (row) =>
        isZero(row.closingStock) || String(row.closingStock).startsWith('-'),
    ).length,
  }
}

/**
 * Share of the filtered sales in the whole company's sales for the period,
 * or null when the company sold nothing in it.
 */
export function salesShare(totals: ReportRow | undefined): number | null {
  if (!totals) return null
  const company = toNumber(totals.companySalesAmount)
  return company > 0 ? toNumber(totals.salesAmount) / company : null
}

/** One part of a composition visual (donut slice or radial ring). */
export interface CompositionPart {
  key: string
  label: string
  /** Plotted magnitude (never negative). */
  value: number
  /** Exact formatted value. */
  display: string
  /** Share of the donut total, or the ring's own ratio (0…1). */
  ratio: number
  color: string
}

export interface Composition {
  title: string
  shape: 'donut' | 'rings'
  centerLabel: string
  centerValue: string
  parts: CompositionPart[]
}

const collectionParts = [
  { key: 'cashAmount', label: t('Tiền mặt'), color: 'var(--chart-1)' },
  {
    key: 'bankTransferAmount',
    label: t('Chuyển khoản'),
    color: 'var(--chart-2)',
  },
  { key: 'onlineAmount', label: t('Trực tuyến'), color: 'var(--chart-3)' },
]

const PRODUCT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
]

/** Exact non-negative difference of two whole-VND strings (0 when below). */
export function remainder(total: unknown, part: unknown): string {
  try {
    const value = BigInt(String(total ?? '0')) - BigInt(String(part ?? '0'))
    return value > 0n ? value.toString() : '0'
  } catch {
    return '0'
  }
}

function donut(
  title: string,
  centerLabel: string,
  center: unknown,
  parts: { key: string; label: string; color: string; raw: unknown }[],
): Composition {
  const shaped = parts.map(({ key, label, color, raw }) => ({
    key,
    label,
    value: Math.max(0, toNumber(raw as string | undefined)),
    display: raw === undefined || raw === null ? '—' : formatVND(String(raw)),
    ratio: 0,
    color,
  }))
  const total = shaped.reduce((sum, part) => sum + part.value, 0)
  for (const part of shaped) part.ratio = total ? part.value / total : 0
  return {
    title,
    shape: 'donut',
    centerLabel,
    centerValue: formatCompactVND(toNumber(center as string | undefined)),
    parts: shaped,
  }
}

/**
 * Part-to-whole view of a report: a donut over the full-filter totals (the
 * product donut ranks the page's leading products), or for inventory (no
 * totals) radial rings of product shares on the current page.
 */
export function compositionOf(
  kind: ReportKind,
  totals: ReportRow | undefined,
  items: ReportRow[],
): Composition {
  switch (kind) {
    case 'inventory': {
      const counts = inventoryCounts(items)
      const share = (n: number) => (counts.products ? n / counts.products : 0)
      const ring = (key: string, label: string, n: number, color: string) => ({
        key,
        label,
        value: n,
        display: `${formatPlain(n)} / ${formatPlain(counts.products)}`,
        ratio: share(n),
        color,
      })
      return {
        title: t('Tình trạng mặt hàng'),
        shape: 'rings',
        centerLabel: t('Mặt hàng'),
        centerValue: formatPlain(counts.products),
        parts: [
          ring('moving', t('Có nhập/xuất'), counts.moving, 'var(--chart-1)'),
          ring('issued', t('Có xuất bán'), counts.issued, 'var(--chart-2)'),
          ring('outOfStock', t('Hết tồn'), counts.outOfStock, 'var(--chart-8)'),
        ],
      }
    }
    case 'sales':
      return donut(
        t('Tỷ trọng trong doanh số công ty'),
        t('Toàn công ty'),
        totals?.companySalesAmount,
        [
          {
            key: 'salesAmount',
            label: t('Đại lý đã lọc'),
            color: 'var(--chart-1)',
            raw: totals?.salesAmount,
          },
          {
            key: 'others',
            label: t('Đại lý khác'),
            color: 'var(--chart-2)',
            raw: totals
              ? remainder(totals.companySalesAmount, totals.salesAmount)
              : undefined,
          },
        ],
      )
    case 'debt':
      return donut(
        t('Phát sinh và đã thu'),
        t('Nợ cuối kỳ'),
        totals?.closingDebt,
        [
          {
            key: 'debtIncrease',
            label: t('Phát sinh nợ'),
            color: 'var(--chart-1)',
            raw: totals?.debtIncrease,
          },
          {
            key: 'paidAmount',
            label: t('Đã thu'),
            color: 'var(--chart-2)',
            raw: totals?.paidAmount,
          },
        ],
      )
    case 'collections':
      return donut(
        t('Cơ cấu hình thức thu'),
        t('Tổng thu'),
        totals?.totalAmount,
        collectionParts.map((part) => ({ ...part, raw: totals?.[part.key] })),
      )
    case 'product-sales': {
      const top = [...items]
        .sort((a, b) => toNumber(b.salesAmount) - toNumber(a.salesAmount))
        .slice(0, PRODUCT_COLORS.length)
      const shown = top.reduce(
        (sum, row) => sum + BigInt(String(row.salesAmount)),
        0n,
      )
      return donut(
        t('Mặt hàng dẫn đầu doanh số'),
        t('Tổng doanh số'),
        totals?.salesAmount,
        [
          ...top.map((row, index) => ({
            key: String(row.productId),
            label: String(row.productName),
            color: PRODUCT_COLORS[index]!,
            raw: row.salesAmount,
          })),
          {
            key: 'others',
            label: t('Mặt hàng khác'),
            color: 'var(--chart-8)',
            raw: totals
              ? remainder(totals.salesAmount, shown.toString())
              : undefined,
          },
        ],
      )
    }
  }
}
