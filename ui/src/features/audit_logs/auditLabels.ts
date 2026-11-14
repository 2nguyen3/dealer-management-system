import { t } from '@/lib/i18n/core'
/** Vietnamese names of audited tables; unknown tables keep their raw name. */
const ENTITY_LABELS: Record<string, string> = {
  agency: t('Đại lý'),
  agency_type: t('Loại đại lý'),
  app_function: t('Chức năng'),
  app_user: t('Tài khoản'),
  business_rule: t('Quy định'),
  // Historical rows only: districts were abolished on 2025-07-01.
  district: t('Quận (cũ)'),
  document: t('Chứng từ'),
  document_line: t('Dòng chứng từ'),
  group_permission: t('Phân quyền'),
  online_payment: t('Thanh toán trực tuyến'),
  payment_event: t('Sự kiện thanh toán'),
  product: t('Mặt hàng'),
  unit: t('Đơn vị tính'),
  user_group: t('Nhóm người dùng'),
  ward: t('Phường/xã'),
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
