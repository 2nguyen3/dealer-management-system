import {
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Store,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { navigationGroups, type NavigationGroupKey } from '../../app/navigation'
import { t } from '@/lib/i18n/core'

/** A work area of the Portal catalogue, with a fixed accent slot. */
export interface WorkArea {
  key: NavigationGroupKey
  name: string
  icon: LucideIcon
  color: string
}

/** Work areas in sidebar order; the overview group only feeds favourites. */
export const WORK_AREAS: readonly WorkArea[] = [
  {
    key: 'agencies',
    name: t('Đại lý & Hàng hóa'),
    icon: Store,
    color: 'var(--chart-1)',
  },
  {
    key: 'documents',
    name: t('Chứng từ'),
    icon: FileText,
    color: 'var(--chart-2)',
  },
  {
    key: 'catalogue',
    name: t('Danh mục & Quy định'),
    icon: Tags,
    color: 'var(--chart-5)',
  },
  {
    key: 'admin',
    name: t('Quản trị & Lịch sử'),
    icon: ShieldCheck,
    color: 'var(--chart-7)',
  },
]

const OVERVIEW: WorkArea = {
  key: 'overview',
  name: t('Tổng quan'),
  icon: LayoutDashboard,
  color: 'var(--chart-4)',
}

/** Work area that holds a route (overview for the dashboard and reports). */
export function areaOf(path: string): WorkArea {
  const group = navigationGroups.find((entry) =>
    entry.items.some((item) => item.path === path),
  )
  return WORK_AREAS.find((area) => area.key === group?.key) ?? OVERVIEW
}

/** One-line hints under each function; kept short on purpose. */
export const DESCRIPTIONS: Readonly<Record<string, string>> = {
  '/dashboard': t('Chỉ số và biểu đồ tổng quan'),
  '/reports': t('Doanh số, công nợ, tồn kho'),
  '/agencies': t('Tiếp nhận đại lý, nợ hiện tại'),
  '/products': t('Mặt hàng, tồn, giá nhập và giá bán'),
  '/stock-receipts': t('Nhập hàng vào kho'),
  '/stock-issues': t('Xuất hàng cho đại lý'),
  '/payment-receipts': t('Thu tiền đại lý'),
  '/online-payments': t('Giao dịch trực tuyến'),
  '/agency-types': t('Loại đại lý, giới hạn nợ'),
  '/units': t('Đơn vị tính'),
  '/business-rules': t('Quy định, tỷ lệ giá bán'),
  '/users': t('Tài khoản, nhóm và trạng thái'),
  '/user-groups': t('Nhóm để phân quyền'),
  '/permissions': t('Cấp/thu hồi quyền'),
  '/audit-logs': t('Lịch sử thay đổi dữ liệu'),
  '/document-history': t('Tra cứu chứng từ đã lập'),
}
