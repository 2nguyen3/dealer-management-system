// On-screen presentation of report values. Exports and request parameters stay
// untouched: these helpers only format the exact strings returned by the server.
import { formatDate, formatQuantity, formatVND } from '../../lib/formatters'
import {
  cashAmounts,
  debtAmounts,
  reports,
  rowRules,
  salesAmounts,
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
  salesAmount: t('Doanh số gộp'),
  returnAmount: t('Hàng trả lại'),
  netSalesAmount: t('Doanh số thuần'),
  salesRate: t('Tỷ lệ doanh số'),
  companyGrossSales: t('Doanh số gộp toàn công ty'),
  openingDebt: t('Nợ đầu kỳ'),
  debtIncrease: t('Phát sinh nợ'),
  cashApplied: t('Thu tiền trừ nợ'),
  returnsApplied: t('Trả hàng trừ nợ'),
  creditApplied: t('Cấn trừ dư có'),
  debtDecrease: t('Tổng giảm nợ'),
  closingDebt: t('Nợ cuối kỳ'),
  openingStock: t('Tồn đầu kỳ'),
  receiptQuantity: t('Nhập'),
  issueQuantity: t('Xuất'),
  returnQuantity: t('Trả lại'),
  adjustmentQuantity: t('Điều chỉnh'),
  closingStock: t('Tồn cuối kỳ'),
  soldQuantity: t('Số lượng bán'),
  returnedQuantity: t('Số lượng trả'),
  cashReceived: t('Tiền đã thu'),
  cashRefunded: t('Tiền đã hoàn'),
  verifiedUnreceiptedAmount: t('Đã xác nhận, chưa lập phiếu thu'),
  openingCredit: t('Dư có đầu kỳ'),
  creditCreated: t('Dư có phát sinh'),
  creditRefunded: t('Dư có đã hoàn'),
  closingCredit: t('Dư có cuối kỳ'),
  currentReservedCredit: t('Dư có đang giữ'),
  currentAvailableCredit: t('Dư có khả dụng'),
}

/** Filter parameter → picker label. Parameter names are unchanged. */
export const filterLabels: Record<string, string> = {
  agencyId: t('Đại lý'),
  typeId: t('Loại đại lý'),
  wardId: t('Phường/xã'),
  productId: t('Mặt hàng'),
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
  return `${columnLabels[key] ?? key}: ${descending ? t('cao đến thấp') : t('thấp đến cao')}`
}

export type ValueKind = 'money' | 'quantity' | 'count' | 'percent' | 'text'

const moneyKeys = new Set([
  ...Object.keys(salesAmounts),
  ...Object.keys(debtAmounts),
  ...Object.keys(cashAmounts),
  'companyGrossSales',
])
const quantityKeys = new Set(
  Object.keys(rowRules.inventory)
    .concat(Object.keys(rowRules['product-sales']))
    .filter((key) => /Quantity$|Stock$/.test(key)),
)

export function valueKind(key: string): ValueKind {
  if (moneyKeys.has(key)) return 'money'
  if (quantityKeys.has(key)) return 'quantity'
  if (key === 'numberOfIssues') return 'count'
  if (key === 'salesRate') return 'percent'
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
    default:
      return raw
  }
}

export function isNumeric(key: string): boolean {
  return valueKind(key) !== 'text'
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
