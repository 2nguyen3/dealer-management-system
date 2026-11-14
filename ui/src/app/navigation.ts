import { t } from '../lib/i18n/core'
import type { FunctionCode } from '../lib/types'

export interface NavigationPolicy {
  allOf?: readonly FunctionCode[]
  anyOf?: readonly FunctionCode[]
}

export interface NavigationItem {
  path: string
  label: string
  policy?: NavigationPolicy
  unavailable?: boolean
}

export const routePermissions: Record<string, NavigationPolicy> = {
  '/agencies': { anyOf: ['agency.read', 'agency.manage'] },
  '/products': { anyOf: ['product.manage', 'inventory.read'] },
  '/agency-types': {
    anyOf: ['agency_type.manage', 'agency.read', 'agency.manage'],
  },
  '/units': { anyOf: ['unit.manage', 'product.manage', 'inventory.read'] },
  '/business-rules': {
    anyOf: [
      'rules.manage',
      'agency.manage',
      'stock.issue.prepare',
      'inventory.read',
    ],
  },
  '/users': { allOf: ['users.manage'] },
  '/user-groups': {
    anyOf: ['groups.manage', 'users.manage', 'permissions.manage'],
  },
  '/permissions': { allOf: ['permissions.manage'] },
  '/audit-logs': { allOf: ['audit.read'] },
  '/inventory': { allOf: ['inventory.read'] },
  '/stock-receipts': {
    anyOf: ['stock.receipt.prepare', 'stock.receipt.post', 'inventory.read'],
  },
  '/stock-issues': {
    anyOf: [
      'stock.issue.prepare',
      'stock.issue.post',
      'debt.read',
      'sales.read',
    ],
  },
  '/payment-receipts': {
    anyOf: ['cash.receipt.prepare', 'cash.receipt.post', 'debt.read'],
  },
  '/upfront-payments': {
    anyOf: ['cash.upfront.verify', 'cash.receipt.post', 'stock.issue.post'],
  },
  '/online-payments': { anyOf: ['payments.online', 'debt.read'] },
  '/receivables': { allOf: ['debt.read'] },
  '/sales-returns': {
    anyOf: ['returns.prepare', 'returns.post', 'debt.read', 'sales.read'],
  },
  '/credit-applications': { anyOf: ['credit.apply', 'debt.read'] },
  '/refunds': {
    anyOf: ['cash.refund.prepare', 'cash.refund.post', 'debt.read'],
  },
  '/stock-adjustments': {
    anyOf: [
      'stock.adjustment.prepare',
      'stock.adjustment.post',
      'inventory.read',
    ],
  },
  '/stock-counts': { allOf: ['stock.count'] },
  '/agency-credit': {
    anyOf: ['debt.read', 'credit.apply', 'cash.refund.post'],
  },
  '/reports': {
    allOf: ['reports.read'],
    anyOf: ['sales.read', 'debt.read', 'inventory.read'],
  },
  '/dashboard': {
    anyOf: [
      'agency.read',
      'inventory.read',
      'sales.read',
      'debt.read',
      'stock.issue.post',
      'cash.upfront.verify',
    ],
  },
  '/document-corrections': { anyOf: ['documents.correct', 'documents.cancel'] },
}

export function allowsNavigation(
  hasPermission: (permission: FunctionCode) => boolean,
  policy?: NavigationPolicy,
): boolean {
  return (
    (!policy?.allOf || policy.allOf.every(hasPermission)) &&
    (!policy?.anyOf || policy.anyOf.some(hasPermission))
  )
}

/** Stable group keys; labels are translated, so code never matches on text. */
export type NavigationGroupKey =
  'overview' | 'agencies' | 'stock' | 'money' | 'catalogue' | 'admin'

export const navigationGroups: {
  key: NavigationGroupKey
  title: string
  items: NavigationItem[]
}[] = [
  {
    key: 'overview',
    title: t('Tổng quan'),
    items: [
      { path: '/', label: t('Bàn làm việc') },
      { path: '/dashboard', label: t('Bảng điều khiển') },
      { path: '/reports', label: t('Báo cáo kinh doanh') },
    ],
  },
  {
    key: 'agencies',
    title: t('Đại lý & Hàng hóa'),
    items: [
      { path: '/agencies', label: t('Hồ sơ đại lý') },
      { path: '/products', label: t('Danh mục mặt hàng') },
      { path: '/inventory', label: t('Tồn kho & Thẻ kho') },
      { path: '/agency-credit', label: t('Hạn mức & Dư có') },
    ],
  },
  {
    key: 'stock',
    title: t('Giao dịch kho'),
    items: [
      { path: '/stock-receipts', label: t('Phiếu nhập hàng') },
      { path: '/stock-issues', label: t('Phiếu xuất hàng') },
      { path: '/sales-returns', label: t('Phiếu trả hàng') },
      { path: '/stock-adjustments', label: t('Điều chỉnh kho') },
      { path: '/stock-counts', label: t('Kiểm kê kho') },
    ],
  },
  {
    key: 'money',
    title: t('Thu tiền & Công nợ'),
    items: [
      { path: '/receivables', label: t('Công nợ đại lý') },
      { path: '/payment-receipts', label: t('Phiếu thu tiền') },
      { path: '/upfront-payments', label: t('Xác nhận trả ngay') },
      { path: '/credit-applications', label: t('Bù trừ dư có') },
      { path: '/online-payments', label: t('Thanh toán trực tuyến') },
      { path: '/refunds', label: t('Hoàn tiền đại lý') },
    ],
  },
  {
    key: 'catalogue',
    title: t('Danh mục & Quy định'),
    items: [
      { path: '/agency-types', label: t('Loại đại lý') },
      { path: '/units', label: t('Đơn vị tính') },
      { path: '/business-rules', label: t('Thay đổi quy định') },
    ],
  },
  {
    key: 'admin',
    title: t('Quản trị & Lịch sử'),
    items: [
      { path: '/users', label: t('Tài khoản người dùng') },
      { path: '/user-groups', label: t('Nhóm người dùng') },
      { path: '/permissions', label: t('Phân quyền chức năng') },
      { path: '/audit-logs', label: t('Nhật ký hệ thống') },
      { path: '/document-history', label: t('Lịch sử chứng từ') },
      { path: '/document-corrections', label: t('Sửa sai & Hủy chứng từ') },
      { path: '/chatbot', label: t('Trợ lý AI'), unavailable: true },
    ],
  },
]

/** Translated page name of a workspace route (falls back to the path). */
export function routeLabel(path: string): string {
  if (path === '/profile') return t('Hồ sơ cá nhân')
  const item = navigationGroups
    .flatMap((group) => group.items)
    .find((entry) => entry.path === path)
  return item ? item.label : path
}
