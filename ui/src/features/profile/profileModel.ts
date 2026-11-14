import type { FunctionCode } from '@/lib/types'
import { t } from '@/lib/i18n/core'

/** Permission areas shown on the profile, in fixed chart-slot order. */
export const PERMISSION_AREAS: readonly {
  key: string
  label: string
  codes: readonly { code: FunctionCode; label: string }[]
}[] = [
  {
    key: 'catalog',
    label: t('Danh mục'),
    codes: [
      { code: 'agency_type.manage', label: t('Loại đại lý') },
      { code: 'unit.manage', label: t('Đơn vị tính') },
      { code: 'product.manage', label: t('Mặt hàng') },
      { code: 'agency.read', label: t('Xem đại lý') },
      { code: 'agency.manage', label: t('Quản lý đại lý') },
      { code: 'rules.manage', label: t('Quy định') },
    ],
  },
  {
    key: 'stock',
    label: t('Kho hàng'),
    codes: [
      { code: 'stock.receipt.prepare', label: t('Lập phiếu nhập') },
      { code: 'stock.receipt.post', label: t('Ghi sổ phiếu nhập') },
      { code: 'stock.issue.prepare', label: t('Lập phiếu xuất') },
      { code: 'stock.issue.post', label: t('Ghi sổ phiếu xuất') },
    ],
  },
  {
    key: 'finance',
    label: t('Tài chính'),
    codes: [
      { code: 'cash.receipt.prepare', label: t('Lập phiếu thu') },
      { code: 'cash.receipt.post', label: t('Ghi sổ phiếu thu') },
      { code: 'payments.online', label: t('Thanh toán trực tuyến') },
      { code: 'debt.read', label: t('Xem công nợ') },
    ],
  },
  {
    key: 'insight',
    label: t('Báo cáo'),
    codes: [
      { code: 'sales.read', label: t('Doanh số') },
      { code: 'reports.read', label: t('Báo cáo') },
    ],
  },
  {
    key: 'admin',
    label: t('Quản trị'),
    codes: [
      { code: 'users.manage', label: t('Người dùng') },
      { code: 'groups.manage', label: t('Nhóm') },
      { code: 'permissions.manage', label: t('Phân quyền') },
      { code: 'audit.read', label: t('Nhật ký') },
      { code: 'documents.correct', label: t('Sửa chứng từ') },
      { code: 'documents.cancel', label: t('Hủy chứng từ') },
    ],
  },
]

export function permissionCoverage(granted: ReadonlySet<string>) {
  return PERMISSION_AREAS.map((area) => {
    const count = area.codes.filter(({ code }) => granted.has(code)).length
    return {
      key: area.key,
      label: area.label,
      granted: count,
      total: area.codes.length,
      ratio: area.codes.length ? count / area.codes.length : 0,
    }
  })
}

/** Initials from the last word (Vietnamese given name comes last). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const last = parts.at(-1) ?? ''
  const first = parts.length > 1 ? (parts[0] ?? '') : ''
  return (first.charAt(0) + last.charAt(0)).toLocaleUpperCase('vi') || '?'
}

export function daysSince(iso: string, now = Date.now()): number | null {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.floor((now - time) / 86_400_000))
}
