import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Badge } from '../components/ui/Badge'
import {
  BuildingIcon,
  DollarSignIcon,
  FileTextIcon,
  KeyIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  XIcon,
} from '../components/ui/Icons'
import { useAuth } from '../features/authentication/useAuth'
import { ChangePasswordModal } from '../features/authentication/ChangePasswordModal'
import type { FunctionCode } from '../lib/types'

interface NavItemConfig {
  path: string
  label: string
  requiredPermission?: FunctionCode | FunctionCode[]
}

interface NavGroupConfig {
  title: string
  icon: ReactNode
  items: NavItemConfig[]
}

export function ShellLayout() {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const navGroups: NavGroupConfig[] = [
    {
      title: 'Đại lý',
      icon: <BuildingIcon size={18} />,
      items: [
        {
          path: '/agencies',
          label: 'Hồ sơ đại lý',
          requiredPermission: 'agency.read',
        },
        {
          path: '/agency-credit',
          label: 'Hạn mức & Dư có',
          requiredPermission: 'agency.read',
        },
      ],
    },
    {
      title: 'Kho & Hàng hóa',
      icon: <PackageIcon size={18} />,
      items: [
        {
          path: '/products',
          label: 'Danh mục mặt hàng',
          requiredPermission: 'product.manage',
        },
        {
          path: '/stock-receipts',
          label: 'Phiếu nhập hàng',
          requiredPermission: ['stock.receipt.prepare', 'stock.receipt.post'],
        },
        {
          path: '/stock-issues',
          label: 'Phiếu xuất hàng',
          requiredPermission: ['stock.issue.prepare', 'stock.issue.post'],
        },
        {
          path: '/inventory',
          label: 'Tồn kho & Thẻ kho',
          requiredPermission: 'inventory.read',
        },
        {
          path: '/stock-adjustments',
          label: 'Điều chỉnh kho',
          requiredPermission: [
            'stock.adjustment.prepare',
            'stock.adjustment.post',
          ],
        },
        {
          path: '/stock-counts',
          label: 'Kiểm kê kho',
          requiredPermission: 'stock.count',
        },
      ],
    },
    {
      title: 'Thu tiền & Công nợ',
      icon: <DollarSignIcon size={18} />,
      items: [
        {
          path: '/payment-receipts',
          label: 'Phiếu thu tiền',
          requiredPermission: ['cash.receipt.prepare', 'cash.receipt.post'],
        },
        {
          path: '/online-payments',
          label: 'Thanh toán trực tuyến',
          requiredPermission: ['payments.online', 'debt.read'],
        },
        {
          path: '/upfront-payments',
          label: 'Xác nhận trả ngay',
          requiredPermission: 'cash.upfront.verify',
        },
        {
          path: '/receivables',
          label: 'Công nợ đại lý',
          requiredPermission: 'debt.read',
        },
        {
          path: '/sales-returns',
          label: 'Phiếu trả hàng',
          requiredPermission: ['returns.prepare', 'returns.post'],
        },
        {
          path: '/credit-applications',
          label: 'Bù trừ dư có',
          requiredPermission: ['credit.apply', 'debt.read'],
        },
        {
          path: '/refunds',
          label: 'Hoàn tiền đại lý',
          requiredPermission: [
            'cash.refund.prepare',
            'cash.refund.post',
            'debt.read',
          ],
        },
      ],
    },
    {
      title: 'Danh mục & Quy định',
      icon: <SettingsIcon size={18} />,
      items: [
        {
          path: '/districts',
          label: 'Danh sách quận',
          requiredPermission: 'district.manage',
        },
        {
          path: '/agency-types',
          label: 'Loại đại lý',
          requiredPermission: 'agency_type.manage',
        },
        {
          path: '/units',
          label: 'Đơn vị tính',
          requiredPermission: 'unit.manage',
        },
        {
          path: '/business-rules',
          label: 'Thay đổi quy định',
          requiredPermission: 'rules.manage',
        },
      ],
    },
    {
      title: 'Báo cáo & Thống kê',
      icon: <FileTextIcon size={18} />,
      items: [
        {
          path: '/dashboard',
          label: 'Bảng điều khiển',
        },
        {
          path: '/reports',
          label: 'Báo cáo kinh doanh',
          requiredPermission: [
            'reports.read',
            'sales.read',
            'debt.read',
            'inventory.read',
          ],
        },
        {
          path: '/chatbot',
          label: 'Trợ lý ảo Chatbot',
        },
      ],
    },
    {
      title: 'Quản trị hệ thống',
      icon: <ShieldIcon size={18} />,
      items: [
        {
          path: '/users',
          label: 'Tài khoản người dùng',
          requiredPermission: 'users.manage',
        },
        {
          path: '/user-groups',
          label: 'Nhóm người dùng',
          requiredPermission: 'groups.manage',
        },
        {
          path: '/permissions',
          label: 'Phân quyền chức năng',
          requiredPermission: 'permissions.manage',
        },
        {
          path: '/audit-logs',
          label: 'Nhật ký hệ thống',
          requiredPermission: 'audit.read',
        },
        {
          path: '/document-history',
          label: 'Lịch sử chứng từ',
        },
        {
          path: '/document-corrections',
          label: 'Sửa sai & Hủy chứng từ',
          requiredPermission: ['documents.correct', 'documents.cancel'],
        },
      ],
    },
  ]

  // Filter groups and items by user's actual permissions
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.requiredPermission || hasPermission(item.requiredPermission),
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="shell-container">
      {/* Top Header */}
      <header className="shell-header">
        <div className="shell-header-left">
          <button
            type="button"
            className="shell-mobile-toggle"
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
            aria-label={isMobileNavOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {isMobileNavOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
          </button>
          <NavLink to="/" className="shell-logo">
            <span className="brand-wordmark">Agentra</span>
            <span className="shell-logo-badge">DMS</span>
          </NavLink>
        </div>

        <div className="shell-header-right">
          {user && (
            <div className="shell-user-info">
              <div className="shell-user-avatar" aria-hidden="true">
                <UserIcon size={18} />
              </div>
              <div className="shell-user-details">
                <span className="shell-user-name">{user.fullName}</span>
                <Badge variant="info" className="shell-user-badge">
                  {user.groupName}
                </Badge>
              </div>
            </div>
          )}

          <div className="shell-header-actions">
            <button
              type="button"
              className="shell-action-btn"
              onClick={() => setIsPasswordModalOpen(true)}
              title="Đổi mật khẩu"
            >
              <KeyIcon size={16} />
              <span className="shell-action-label">Đổi mật khẩu</span>
            </button>
            <button
              type="button"
              className="shell-action-btn shell-action-btn--logout"
              onClick={handleLogout}
              title="Đăng xuất"
            >
              <LogOutIcon size={16} />
              <span className="shell-action-label">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <div className="shell-body">
        {/* Sidebar Navigation */}
        <aside
          className={`shell-sidebar ${isMobileNavOpen ? 'shell-sidebar--open' : ''}`.trim()}
        >
          <nav className="shell-nav" aria-label="Điều hướng nghiệp vụ">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `shell-nav-link shell-nav-link--root ${isActive ? 'shell-nav-link--active' : ''}`.trim()
              }
              onClick={() => setIsMobileNavOpen(false)}
            >
              <FileTextIcon size={18} />
              <span>Tổng quan làm việc</span>
            </NavLink>

            {visibleGroups.map((group) => (
              <div key={group.title} className="shell-nav-group">
                <div className="shell-nav-group-title">
                  <span className="shell-nav-group-icon" aria-hidden="true">
                    {group.icon}
                  </span>
                  <span>{group.title}</span>
                </div>
                <div className="shell-nav-group-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `shell-nav-link ${isActive ? 'shell-nav-link--active' : ''}`.trim()
                      }
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile Backdrop */}
        {isMobileNavOpen && (
          <div
            className="shell-sidebar-backdrop"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Content Area */}
        <main className="shell-content" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  )
}
