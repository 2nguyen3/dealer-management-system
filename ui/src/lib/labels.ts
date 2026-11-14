import { t } from '@/lib/i18n/core'
/**
 * Vietnamese display labels for server enum values. Server values stay the
 * authority for logic and requests; these maps are presentation only.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const STATUS_LABELS: Record<string, string> = {
  // Lifecycle of documents/revisions
  DRAFT: t('Nháp'),
  READY: t('Sẵn sàng'),
  PENDING: t('Chờ xử lý'),
  SUBMITTED: t('Đã gửi'),
  CONFIRMED: t('Đã xác nhận'),
  VERIFIED: t('Đã xác minh'),
  POSTED: t('Đã ghi sổ'),
  PAID: t('Đã thanh toán'),
  UNPAID: t('Chưa thanh toán'),
  PARTIALLY_PAID: t('Thanh toán một phần'),
  CANCELED: t('Đã hủy'),
  CANCELLED: t('Đã hủy'),
  CONSUMED: t('Đã sử dụng'),
  RELEASED: t('Đã giải phóng'),
  RECEIVED_SEPARATELY: t('Đã thu riêng'),
  // Settlement
  SETTLED: t('Đã tất toán'),
  PARTIAL: t('Tất toán một phần'),
  UNSETTLED: t('Chưa tất toán'),
  // Provider/payment attempts
  SUCCESS: t('Thành công'),
  FAILED: t('Thất bại'),
  EXPIRED: t('Hết hạn'),
  UNKNOWN: t('Chưa rõ'),
  // Master data
  ACTIVE: t('Đang hoạt động'),
  INACTIVE: t('Ngừng hoạt động'),
  LOCKED: t('Đã khóa'),
  TERMINATED: t('Đã chấm dứt'),
  DISCONTINUED: t('Ngừng kinh doanh'),
}

const STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  READY: 'info',
  PENDING: 'warning',
  SUBMITTED: 'info',
  CONFIRMED: 'info',
  VERIFIED: 'info',
  POSTED: 'success',
  PAID: 'success',
  UNPAID: 'warning',
  PARTIALLY_PAID: 'warning',
  CANCELED: 'danger',
  CANCELLED: 'danger',
  CONSUMED: 'neutral',
  RELEASED: 'neutral',
  RECEIVED_SEPARATELY: 'info',
  SETTLED: 'success',
  PARTIAL: 'warning',
  UNSETTLED: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
  UNKNOWN: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  LOCKED: 'danger',
  TERMINATED: 'danger',
  DISCONTINUED: 'neutral',
}

const KIND_LABELS: Record<string, string> = {
  STOCK_RECEIPT: t('Phiếu nhập hàng'),
  STOCK_ISSUE: t('Phiếu xuất hàng'),
  PAYMENT_RECEIPT: t('Phiếu thu tiền'),
  SALES_RETURN: t('Phiếu trả hàng'),
  STOCK_ADJUSTMENT: t('Phiếu điều chỉnh kho'),
  CREDIT_APPLICATION: t('Cấn trừ dư có'),
  REFUND: t('Hoàn tiền'),
  // Ledger entry kinds
  CHARGE: t('Ghi nợ'),
  PAYMENT: t('Thanh toán'),
  CREDIT: t('Ghi có'),
  OFFSET: t('Cấn trừ'),
  RETURN: t('Trả hàng'),
  CREATED: t('Khởi tạo'),
}

const METHOD_LABELS: Record<string, string> = {
  CASH: t('Tiền mặt'),
  BANK_TRANSFER: t('Chuyển khoản'),
  ONLINE: t('Trực tuyến (VNPAY)'),
}

const RECEIPT_TYPE_LABELS: Record<string, string> = {
  AUTO_FROM_ISSUE: t('Thu kèm phiếu xuất'),
  DEBT_COLLECTION: t('Thu công nợ'),
  RECEIVED_UNAPPLIED: t('Thu chưa phân bổ'),
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: t('Tạo mới'),
  UPDATE: t('Cập nhật'),
  DELETE: t('Xóa'),
  SYSTEM: t('Hệ thống'),
  USER: t('Người dùng'),
}

function lookup(map: Record<string, string>, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const key = String(value)
  return map[key] ?? key
}

/** Vietnamese label for a lifecycle/settlement/provider/master status value. */
export function statusLabel(value: unknown): string {
  return lookup(STATUS_LABELS, value)
}

/** Visual tone for a status value; unknown values are neutral. */
export function statusTone(value: unknown): Tone {
  return STATUS_TONES[String(value)] ?? 'neutral'
}

/** Vietnamese label for a document or ledger-entry kind. */
export function kindLabel(value: unknown): string {
  return lookup(KIND_LABELS, value)
}

/** Vietnamese label for a payment method. */
export function methodLabel(value: unknown): string {
  return lookup(METHOD_LABELS, value)
}

/** Vietnamese label for a payment receipt type. */
export function receiptTypeLabel(value: unknown): string {
  return lookup(RECEIPT_TYPE_LABELS, value)
}

/** Vietnamese label for an audit action or actor type. */
export function auditActionLabel(value: unknown): string {
  return lookup(AUDIT_ACTION_LABELS, value)
}

/** Select options for a list of enum values, with an optional "all" entry. */
export function enumOptions(
  values: readonly string[],
  label: (value: string) => string,
  allLabel?: string,
): { value: string; label: string }[] {
  const options = values.map((value) => ({ value, label: label(value) }))
  return allLabel ? [{ value: '', label: allLabel }, ...options] : options
}

/** Kinds of Ho Chi Minh City wards/communes after the 2025 reform. */
export const WARD_KIND_LABELS = {
  WARD: t('Phường'),
  COMMUNE: t('Xã'),
  SPECIAL_ZONE: t('Đặc khu'),
} as const

/** Vietnamese label for a ward kind (Phường / Xã / Đặc khu). */
export function wardKindLabel(value: unknown): string {
  return lookup(WARD_KIND_LABELS, value)
}
