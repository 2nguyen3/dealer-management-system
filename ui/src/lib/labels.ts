import { t } from '@/lib/i18n/core'
/**
 * Vietnamese display labels for server enum values. Server values stay the
 * authority for logic and requests; these maps are presentation only.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const STATUS_LABELS: Record<string, string> = {
  // Lifecycle of documents (DRAFT → POSTED → CANCELLED)
  DRAFT: t('Nháp'),
  PENDING: t('Chờ xử lý'),
  POSTED: t('Đã ghi sổ'),
  CANCELED: t('Đã hủy'),
  CANCELLED: t('Đã hủy'),
  // Online payments (PENDING → SUCCESS | FAILED | EXPIRED)
  SUCCESS: t('Thành công'),
  FAILED: t('Thất bại'),
  EXPIRED: t('Hết hạn'),
  UNKNOWN: t('Chưa rõ'),
  // Master data
  ACTIVE: t('Đang hoạt động'),
  INACTIVE: t('Ngừng hoạt động'),
  LOCKED: t('Đã khóa'),
  TERMINATED: t('Đã chấm dứt'),
}

const STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  POSTED: 'success',
  CANCELED: 'danger',
  CANCELLED: 'danger',
  SUCCESS: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
  UNKNOWN: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  LOCKED: 'danger',
  TERMINATED: 'danger',
}

const KIND_LABELS: Record<string, string> = {
  STOCK_RECEIPT: t('Phiếu nhập hàng'),
  STOCK_ISSUE: t('Phiếu xuất hàng'),
  PAYMENT_RECEIPT: t('Phiếu thu tiền'),
}

const METHOD_LABELS: Record<string, string> = {
  CASH: t('Tiền mặt'),
  BANK_TRANSFER: t('Chuyển khoản'),
  ONLINE: t('Trực tuyến (VNPAY)'),
}

/** `receiptType` of a payment receipt; ONLINE is created only by VNPAY. */
const RECEIPT_TYPE_LABELS: Record<string, string> = {
  CASH: t('Tiền mặt'),
  BANK_TRANSFER: t('Chuyển khoản'),
  ONLINE: t('Trực tuyến (VNPAY)'),
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

/** Vietnamese label for a document/online-payment/master status value. */
export function statusLabel(value: unknown): string {
  return lookup(STATUS_LABELS, value)
}

/** Visual tone for a status value; unknown values are neutral. */
export function statusTone(value: unknown): Tone {
  return STATUS_TONES[String(value)] ?? 'neutral'
}

/** Vietnamese label for a document kind. */
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
