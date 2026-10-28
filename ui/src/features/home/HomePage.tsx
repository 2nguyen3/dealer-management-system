import { Link } from 'react-router'
import {
  BuildingIcon,
  DollarSignIcon,
  PackageIcon,
  SettingsIcon,
  ShieldIcon,
} from '../../components/ui/Icons'
import { useAuth } from '../authentication/useAuth'

export function HomePage() {
  const { user, hasPermission } = useAuth()

  const quickLinks = [
    {
      title: 'Hồ sơ đại lý',
      description: 'Quản lý thông tin, địa chỉ, loại đại lý và số nợ hiện tại',
      path: '/agencies',
      icon: <BuildingIcon size={24} />,
      permission: 'agency.read',
    },
    {
      title: 'Danh mục mặt hàng',
      description: 'Quản lý mã hàng, đơn vị tính, cảnh báo tồn kho tối thiểu',
      path: '/products',
      icon: <PackageIcon size={24} />,
      permission: 'product.manage',
    },
    {
      title: 'Phiếu nhập hàng',
      description: 'Lập phiếu nhập, kiểm tra đơn giá và cập nhật tồn kho',
      path: '/stock-receipts',
      icon: <PackageIcon size={24} />,
      permission: 'stock.receipt.prepare',
    },
    {
      title: 'Phiếu xuất hàng',
      description: 'Lập phiếu xuất cho đại lý, kiểm tra tồn và xuất hóa đơn',
      path: '/stock-issues',
      icon: <PackageIcon size={24} />,
      permission: 'stock.issue.prepare',
    },
    {
      title: 'Phiếu thu tiền',
      description: 'Ghi nhận thanh toán nợ của đại lý theo thứ tự hóa đơn',
      path: '/payment-receipts',
      icon: <DollarSignIcon size={24} />,
      permission: 'cash.receipt.prepare',
    },
    {
      title: 'Công nợ đại lý',
      description:
        'Tra cứu số dư nợ, hạn mức tối đa và hóa đơn chưa thanh toán',
      path: '/receivables',
      icon: <DollarSignIcon size={24} />,
      permission: 'debt.read',
    },
    {
      title: 'Tồn kho & Thẻ kho',
      description: 'Xem chi tiết biến động tồn kho theo từng mặt hàng',
      path: '/inventory',
      icon: <PackageIcon size={24} />,
      permission: 'inventory.read',
    },
    {
      title: 'Quy định hệ thống',
      description:
        'Cấu hình số đại lý tối đa mỗi quận, số loại đại lý và đơn vị tính',
      path: '/business-rules',
      icon: <SettingsIcon size={24} />,
      permission: 'rules.manage',
    },
    {
      title: 'Tài khoản & Phân quyền',
      description: 'Quản lý danh sách tài khoản, nhóm và phân quyền chức năng',
      path: '/users',
      icon: <ShieldIcon size={24} />,
      permission: 'users.manage',
    },
  ]

  const authorizedLinks = quickLinks.filter(
    (item) => !item.permission || hasPermission(item.permission as never),
  )

  return (
    <div className="home-container">
      <div className="home-hero">
        <h1 className="home-title">
          Xin chào, {user?.fullName || 'Người dùng'}
        </h1>
        <p className="home-subtitle">
          Bạn đang đăng nhập với vai trò{' '}
          <strong>{user?.groupName || 'Nhân viên'}</strong>. Chọn một tác vụ bên
          dưới hoặc từ thanh điều hướng để bắt đầu làm việc.
        </p>
      </div>

      <div className="home-section">
        <h2 className="home-section-title">Chức năng làm việc chính</h2>
        <div className="home-grid">
          {authorizedLinks.map((item) => (
            <Link key={item.path} to={item.path} className="home-card">
              <div className="home-card-icon">{item.icon}</div>
              <div className="home-card-content">
                <h3 className="home-card-title">{item.title}</h3>
                <p className="home-card-desc">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
