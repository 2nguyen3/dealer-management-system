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

/** Route gates, mirroring the read (`GET`) `x-permissions` of the API contract. */
export const routePermissions: Record<string, NavigationPolicy> = {
  '/agencies': { anyOf: ['agency.read', 'agency.manage'] },
  '/products': {
    anyOf: [
      'product.manage',
      'stock.receipt.prepare',
      'stock.receipt.post',
      'stock.issue.prepare',
      'stock.issue.post',
      'sales.read',
      'reports.read',
    ],
  },
  '/agency-types': {
    anyOf: ['agency_type.manage', 'agency.read', 'agency.manage'],
  },
  '/units': {
    anyOf: ['unit.manage', 'product.manage', 'stock.receipt.prepare'],
  },
  '/business-rules': {
    anyOf: [
      'rules.manage',
      'agency.manage',
      'stock.issue.prepare',
      'stock.issue.post',
    ],
  },
  '/users': { allOf: ['users.manage'] },
  '/user-groups': {
    anyOf: ['groups.manage', 'users.manage', 'permissions.manage'],
  },
  '/permissions': { allOf: ['permissions.manage'] },
  '/audit-logs': { allOf: ['audit.read'] },
  '/stock-receipts': {
    anyOf: [
      'stock.receipt.prepare',
      'stock.receipt.post',
      'documents.correct',
      'documents.cancel',
      'product.manage',
      'reports.read',
    ],
  },
  '/stock-issues': {
    anyOf: [
      'stock.issue.prepare',
      'stock.issue.post',
      'documents.correct',
      'documents.cancel',
      'debt.read',
      'sales.read',
      'reports.read',
    ],
  },
  '/payment-receipts': {
    anyOf: [
      'cash.receipt.prepare',
      'cash.receipt.post',
      'documents.correct',
      'documents.cancel',
      'debt.read',
      'payments.online',
      'reports.read',
    ],
  },
  '/online-payments': { anyOf: ['payments.online', 'debt.read'] },
  '/reports': { allOf: ['reports.read'] },
  '/dashboard': {
    anyOf: [
      'agency.read',
      'sales.read',
      'debt.read',
      'stock.receipt.prepare',
      'stock.receipt.post',
      'stock.issue.prepare',
      'stock.issue.post',
      'cash.receipt.prepare',
      'cash.receipt.post',
    ],
  },
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
  'overview' | 'agencies' | 'documents' | 'catalogue' | 'admin'

export const navigationGroups: {
  key: NavigationGroupKey
  title: string
  items: NavigationItem[]
}[] = [
  {
    key: 'overview',
    title: t('Tổng quan'),
    items: [
      { path: '/', label: t('Cổng quản lý') },
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
    ],
  },
  {
    key: 'documents',
    title: t('Chứng từ'),
    items: [
      { path: '/stock-receipts', label: t('Phiếu nhập hàng') },
      { path: '/stock-issues', label: t('Phiếu xuất hàng') },
      { path: '/payment-receipts', label: t('Phiếu thu tiền') },
      { path: '/online-payments', label: t('Thanh toán trực tuyến') },
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
