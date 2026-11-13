/**
 * Vietnamese display labels for server enum values. Server values stay the
 * authority for logic and requests; these maps are presentation only.
 */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const STATUS_LABELS: Record<string, string> = {
  // Lifecycle of documents/revisions
  DRAFT: 'Nháp',
  READY: 'Sẵn sàng',
  PENDING: 'Chờ xử lý',
  SUBMITTED: 'Đã gửi',
  CONFIRMED: 'Đã xác nhận',
  VERIFIED: 'Đã xác minh',
  POSTED: 'Đã ghi sổ',
  PAID: 'Đã thanh toán',
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  CANCELED: 'Đã hủy',
  CANCELLED: 'Đã hủy',
  CONSUMED: 'Đã sử dụng',
  RELEASED: 'Đã giải phóng',
  RECEIVED_SEPARATELY: 'Đã thu riêng',
  // Settlement
  SETTLED: 'Đã tất toán',
  PARTIAL: 'Tất toán một phần',
  UNSETTLED: 'Chưa tất toán',
  // Provider/payment attempts
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
  UNKNOWN: 'Chưa rõ',
  // Master data
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  LOCKED: 'Đã khóa',
  TERMINATED: 'Đã chấm dứt',
  DISCONTINUED: 'Ngừng kinh doanh',
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
  STOCK_RECEIPT: 'Phiếu nhập hàng',
  STOCK_ISSUE: 'Phiếu xuất hàng',
  PAYMENT_RECEIPT: 'Phiếu thu tiền',
  SALES_RETURN: 'Phiếu trả hàng',
  STOCK_ADJUSTMENT: 'Phiếu điều chỉnh kho',
  CREDIT_APPLICATION: 'Cấn trừ dư có',
  REFUND: 'Hoàn tiền',
  // Ledger entry kinds
  CHARGE: 'Ghi nợ',
  PAYMENT: 'Thanh toán',
  CREDIT: 'Ghi có',
  OFFSET: 'Cấn trừ',
  RETURN: 'Trả hàng',
  CREATED: 'Khởi tạo',
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  ONLINE: 'Trực tuyến (VNPAY)',
}

const RECEIPT_TYPE_LABELS: Record<string, string> = {
  AUTO_FROM_ISSUE: 'Thu kèm phiếu xuất',
  DEBT_COLLECTION: 'Thu công nợ',
  RECEIVED_UNAPPLIED: 'Thu chưa phân bổ',
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  SYSTEM: 'Hệ thống',
  USER: 'Người dùng',
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
  WARD: 'Phường',
  COMMUNE: 'Xã',
  SPECIAL_ZONE: 'Đặc khu',
} as const

/** Vietnamese label for a ward kind (Phường / Xã / Đặc khu). */
export function wardKindLabel(value: unknown): string {
  return lookup(WARD_KIND_LABELS, value)
}
