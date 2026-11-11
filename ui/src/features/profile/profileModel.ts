import type { FunctionCode } from '@/lib/types'

/** Permission areas shown on the profile, in fixed chart-slot order. */
export const PERMISSION_AREAS: readonly {
  key: string
  label: string
  codes: readonly { code: FunctionCode; label: string }[]
}[] = [
  {
    key: 'catalog',
    label: 'Danh mục',
    codes: [
      { code: 'district.manage', label: 'Quận' },
      { code: 'agency_type.manage', label: 'Loại đại lý' },
      { code: 'unit.manage', label: 'Đơn vị tính' },
      { code: 'product.manage', label: 'Mặt hàng' },
      { code: 'agency.read', label: 'Xem đại lý' },
      { code: 'agency.manage', label: 'Quản lý đại lý' },
      { code: 'rules.manage', label: 'Quy định' },
    ],
  },
  {
    key: 'stock',
    label: 'Kho hàng',
    codes: [
      { code: 'inventory.read', label: 'Xem tồn kho' },
      { code: 'stock.receipt.prepare', label: 'Lập phiếu nhập' },
      { code: 'stock.receipt.post', label: 'Ghi sổ phiếu nhập' },
      { code: 'stock.issue.prepare', label: 'Lập phiếu xuất' },
      { code: 'stock.issue.post', label: 'Ghi sổ phiếu xuất' },
      { code: 'stock.count', label: 'Kiểm kê' },
      { code: 'stock.adjustment.prepare', label: 'Lập điều chỉnh' },
      { code: 'stock.adjustment.post', label: 'Ghi sổ điều chỉnh' },
      { code: 'returns.prepare', label: 'Lập trả hàng' },
      { code: 'returns.post', label: 'Ghi sổ trả hàng' },
    ],
  },
  {
    key: 'finance',
    label: 'Tài chính',
    codes: [
      { code: 'cash.receipt.prepare', label: 'Lập phiếu thu' },
      { code: 'cash.receipt.post', label: 'Ghi sổ phiếu thu' },
      { code: 'cash.upfront.verify', label: 'Xác nhận trả ngay' },
      { code: 'cash.refund.prepare', label: 'Lập hoàn tiền' },
      { code: 'cash.refund.post', label: 'Ghi sổ hoàn tiền' },
      { code: 'credit.apply', label: 'Bù trừ dư có' },
      { code: 'payments.online', label: 'Thanh toán trực tuyến' },
      { code: 'debt.read', label: 'Xem công nợ' },
    ],
  },
  {
    key: 'insight',
    label: 'Báo cáo',
    codes: [
      { code: 'sales.read', label: 'Doanh số' },
      { code: 'reports.read', label: 'Báo cáo' },
    ],
  },
  {
    key: 'admin',
    label: 'Quản trị',
    codes: [
      { code: 'users.manage', label: 'Người dùng' },
      { code: 'groups.manage', label: 'Nhóm' },
      { code: 'permissions.manage', label: 'Phân quyền' },
      { code: 'audit.read', label: 'Nhật ký' },
      { code: 'documents.correct', label: 'Sửa chứng từ' },
      { code: 'documents.cancel', label: 'Hủy chứng từ' },
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
