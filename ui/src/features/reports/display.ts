// On-screen presentation of report values. Exports and request parameters stay
// untouched: these helpers only format the exact strings returned by the server.
import { formatDate, formatQuantity, formatVND } from '../../lib/formatters'
import {
  collectionAmounts,
  debtAmounts,
  reports,
  rowRules,
  type ReportKind,
} from './contracts'
import { t } from '@/lib/i18n/core'

/** Database identifiers are kept for requests/row keys but not shown. */
export const hiddenColumns = new Set(['agencyId', 'productId', 'unitId'])

export const columnLabels: Record<string, string> = {
  agencyCode: t('Mã đại lý'),
  agencyName: t('Tên đại lý'),
  productCode: t('Mã hàng'),
  productName: t('Mặt hàng'),
  unitName: t('Đơn vị'),
  numberOfIssues: t('Số phiếu xuất'),
  salesAmount: t('Doanh số'),
  salesRate: t('Tỷ lệ doanh số'),
  companySalesAmount: t('Doanh số toàn công ty'),
  openingDebt: t('Nợ đầu kỳ'),
  debtIncrease: t('Phát sinh nợ'),
  paidAmount: t('Đã thu'),
  closingDebt: t('Nợ cuối kỳ'),
  openingStock: t('Tồn đầu kỳ'),
  receiptQuantity: t('Nhập'),
  issueQuantity: t('Xuất'),
  closingStock: t('Tồn cuối kỳ'),
  soldQuantity: t('Số lượng bán'),
  businessDate: t('Ngày'),
  receiptCount: t('Số phiếu thu'),
  cashAmount: t('Tiền mặt'),
  bankTransferAmount: t('Chuyển khoản'),
  onlineAmount: t('Trực tuyến'),
  totalAmount: t('Tổng thu'),
}

/** Filter parameter → picker label. Parameter names are unchanged. */
export const filterLabels: Record<string, string> = {
  agencyId: t('Đại lý'),
  typeId: t('Loại đại lý'),
  wardId: t('Phường/xã'),
  productId: t('Mặt hàng'),
  receiptType: t('Hình thức thu'),
}

const sortSubjects: Record<string, string> = {
  agencyId: t('Đại lý'),
  productId: t('Mặt hàng'),
}

/** Readable label for an exact server sort value such as `-salesAmount`. */
export function sortLabel(sort: string): string {
  const descending = sort.startsWith('-')
  const key = sort.replace(/^-/, '')
  const subject = sortSubjects[key]
  if (subject)
    return `${subject}: ${descending ? t('mới thêm trước') : t('cũ trước')}`
  if (key === 'businessDate')
    return `${columnLabels.businessDate}: ${descending ? t('mới nhất trước') : t('cũ nhất trước')}`
  return `${columnLabels[key] ?? key}: ${descending ? t('cao đến thấp') : t('thấp đến cao')}`
}

export type ValueKind =
  'money' | 'quantity' | 'count' | 'percent' | 'date' | 'text'

const moneyKeys = new Set([
  ...Object.keys(debtAmounts),
  ...Object.keys(collectionAmounts).filter((key) => key !== 'receiptCount'),
  'salesAmount',
  'companySalesAmount',
])
const quantityKeys = new Set(
  Object.keys(rowRules.inventory)
    .concat(Object.keys(rowRules['product-sales']))
    .filter((key) => /Quantity$|Stock$/.test(key)),
)

export function valueKind(key: string): ValueKind {
  if (moneyKeys.has(key)) return 'money'
  if (quantityKeys.has(key)) return 'quantity'
  if (key === 'numberOfIssues' || key === 'receiptCount') return 'count'
  if (key === 'salesRate') return 'percent'
  if (key === 'businessDate') return 'date'
  return 'text'
}

/** Formats an exact server value without numeric coercion. */
export function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const raw = String(value)
  switch (valueKind(key)) {
    case 'money':
      return formatVND(raw)
    case 'quantity':
    case 'count':
      return formatQuantity(raw)
    case 'percent':
      return `${formatQuantity(raw)} %`
    case 'date':
      return formatDate(raw)
    default:
      return raw
  }
}

export function isNumeric(key: string): boolean {
  const kind = valueKind(key)
  return kind !== 'text' && kind !== 'date'
}

export function visibleColumns(kind: ReportKind): string[] {
  return Object.keys(rowRules[kind]).filter((key) => !hiddenColumns.has(key))
}

/**
 * Visible columns the server can order by: the contract `sort` enum holds
 * both `field` and `-field`. Identity sorts (agencyId/productId) have no
 * visible column and stay in the filter bar's sort select.
 */
export function sortableColumns(kind: ReportKind): Set<string> {
  const sorts = reports[kind].sorts
  return new Set(
    visibleColumns(kind).filter(
      (col) => sorts.includes(col) && sorts.includes(`-${col}`),
    ),
  )
}

/** Human period for the exclusive `[fromDate, toDate)` interval. */
export function periodLabel(fromDate: string, toDate: string): string {
  const end = new Date(`${toDate}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  const last = Number.isNaN(end.getTime())
    ? toDate
    : end.toISOString().slice(0, 10)
  return `${formatDate(fromDate)} – ${formatDate(last)}`
}

/** Short reason shown when export buttons are disabled. */
export function exportHint(
  hasPage: boolean,
  dirty: boolean,
  exporting: boolean,
): string | null {
  if (exporting) return t('Đang xuất tệp, vui lòng chờ.')
  if (!hasPage) return t('Xem báo cáo trước để có thể xuất tệp.')
  if (dirty)
    return t('Bộ lọc đã thay đổi. Nhấn Áp dụng để cập nhật trước khi xuất.')
  return null
}
