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
  '/districts': { anyOf: ['district.manage', 'agency.read', 'agency.manage'] },
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

export const navigationGroups: { title: string; items: NavigationItem[] }[] = [
  {
    title: 'Tổng quan',
    items: [
      { path: '/', label: 'Bàn làm việc' },
      { path: '/dashboard', label: 'Bảng điều khiển' },
      { path: '/reports', label: 'Báo cáo kinh doanh' },
    ],
  },
  {
    title: 'Đại lý & Hàng hóa',
    items: [
      { path: '/agencies', label: 'Hồ sơ đại lý' },
      { path: '/products', label: 'Danh mục mặt hàng' },
      { path: '/inventory', label: 'Tồn kho & Thẻ kho' },
      { path: '/agency-credit', label: 'Hạn mức & Dư có' },
    ],
  },
  {
    title: 'Giao dịch kho',
    items: [
      { path: '/stock-receipts', label: 'Phiếu nhập hàng' },
      { path: '/stock-issues', label: 'Phiếu xuất hàng' },
      { path: '/sales-returns', label: 'Phiếu trả hàng' },
      { path: '/stock-adjustments', label: 'Điều chỉnh kho' },
      { path: '/stock-counts', label: 'Kiểm kê kho' },
    ],
  },
  {
    title: 'Thu tiền & Công nợ',
    items: [
      { path: '/receivables', label: 'Công nợ đại lý' },
      { path: '/payment-receipts', label: 'Phiếu thu tiền' },
      { path: '/upfront-payments', label: 'Xác nhận trả ngay' },
      { path: '/credit-applications', label: 'Bù trừ dư có' },
      { path: '/online-payments', label: 'Thanh toán trực tuyến' },
      { path: '/refunds', label: 'Hoàn tiền đại lý' },
    ],
  },
  {
    title: 'Danh mục & Quy định',
    items: [
      { path: '/districts', label: 'Danh sách quận' },
      { path: '/agency-types', label: 'Loại đại lý' },
      { path: '/units', label: 'Đơn vị tính' },
      { path: '/business-rules', label: 'Thay đổi quy định' },
    ],
  },
  {
    title: 'Quản trị & Lịch sử',
    items: [
      { path: '/users', label: 'Tài khoản người dùng' },
      { path: '/user-groups', label: 'Nhóm người dùng' },
      { path: '/permissions', label: 'Phân quyền chức năng' },
      { path: '/audit-logs', label: 'Nhật ký hệ thống' },
      { path: '/document-history', label: 'Lịch sử chứng từ' },
      { path: '/document-corrections', label: 'Sửa sai & Hủy chứng từ' },
      { path: '/chatbot', label: 'Trợ lý AI', unavailable: true },
    ],
  },
]
