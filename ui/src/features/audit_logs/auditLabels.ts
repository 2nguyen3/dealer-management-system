/** Vietnamese names of audited tables; unknown tables keep their raw name. */
const ENTITY_LABELS: Record<string, string> = {
  agency: 'Đại lý',
  agency_balance: 'Số dư đại lý',
  agency_type: 'Loại đại lý',
  app_function: 'Chức năng',
  app_user: 'Tài khoản',
  business_rule: 'Quy định',
  credit_entry: 'Bút toán dư có',
  credit_lot: 'Lô dư có',
  district: 'Quận',
  document: 'Chứng từ',
  document_line: 'Dòng chứng từ',
  document_revision: 'Phiên bản chứng từ',
  group_permission: 'Phân quyền',
  inventory_balance: 'Tồn kho',
  inventory_entry: 'Thẻ kho',
  online_payment: 'Thanh toán trực tuyến',
  payment_event: 'Sự kiện thanh toán',
  posting_batch: 'Lô ghi sổ',
  product: 'Mặt hàng',
  receivable_entry: 'Bút toán công nợ',
  refund_attempt: 'Lần hoàn tiền',
  refund_reservation: 'Giữ chỗ hoàn tiền',
  stock_count: 'Phiếu kiểm kê',
  stock_count_line: 'Dòng kiểm kê',
  unit: 'Đơn vị tính',
  upfront_confirmation: 'Xác nhận trả ngay',
  user_group: 'Nhóm người dùng',
}

export function entityLabel(name: unknown): string {
  const raw = String(name ?? '')
  const bare = raw.replace(/^.*\./, '')
  return ENTITY_LABELS[bare] ?? ENTITY_LABELS[bare.replace(/s$/, '')] ?? raw
}

/** Top-level keys whose values differ between the two snapshots. */
export function changedKeys(before: unknown, after: unknown): string[] {
  const left =
    before && typeof before === 'object' && !Array.isArray(before)
      ? (before as Record<string, unknown>)
      : {}
  const right =
    after && typeof after === 'object' && !Array.isArray(after)
      ? (after as Record<string, unknown>)
      : {}
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    .sort()
}
