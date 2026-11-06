import { Link } from 'react-router'
import { Button } from '../../components/shadcn/button'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
} from '../../app/navigation'
import {
  BuildingIcon,
  DollarSignIcon,
  FileTextIcon,
  PackageIcon,
} from '../../components/ui/Icons'
import { useAuth } from '../authentication/useAuth'

export function HomePage() {
  const { user, hasPermission } = useAuth()
  const workAreas = [
    {
      name: 'Đại lý & Hàng hóa',
      icon: <BuildingIcon size={22} />,
    },
    {
      name: 'Giao dịch kho',
      icon: <PackageIcon size={22} />,
    },
    {
      name: 'Thu tiền & Công nợ',
      icon: <DollarSignIcon size={22} />,
    },
  ]
  const groups = workAreas
    .map((area) => ({
      ...area,
      items: navigationGroups
        .find((group) => group.title === area.name)!
        .items.filter((item) =>
          allowsNavigation(hasPermission, routePermissions[item.path]),
        ),
    }))
    .filter((area) => area.items.length > 0)
  const canDashboard = allowsNavigation(
    hasPermission,
    routePermissions['/dashboard'],
  )
  const canReports = allowsNavigation(
    hasPermission,
    routePermissions['/reports'],
  )
  const date = new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())

  return (
    <div className="home-container">
      <div className="home-heading">
        <div>
          <h1 className="home-title">Bàn làm việc</h1>
          <p className="home-greeting">
            Xin chào, {user?.fullName || 'Người dùng'}
          </p>
        </div>
        <span className="workspace-date">{date}</span>
      </div>
      {(canDashboard || canReports) && (
        <nav className="home-shortcuts" aria-label="Truy cập nhanh">
          {canDashboard && (
            <Button asChild>
              <Link to="/dashboard">Xem tổng quan</Link>
            </Button>
          )}
          {canReports && (
            <Button asChild variant="outline">
              <Link to="/reports">Mở báo cáo</Link>
            </Button>
          )}
        </nav>
      )}
      <section
        className="home-directory"
        aria-labelledby="home-directory-title"
      >
        <div className="home-directory-heading">
          <h2 id="home-directory-title">Nghiệp vụ</h2>
          <span>Chỉ hiện chức năng bạn được phép truy cập</span>
        </div>
        {groups.map((area) => (
          <div className="home-work-group" key={area.name}>
            <div className="home-work-title">
              <span aria-hidden="true">{area.icon}</span>
              <h3>{area.name}</h3>
            </div>
            <div className="home-work-links">
              {area.items.map((item) => (
                <Link to={item.path} key={item.path}>
                  {item.label}
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="workspace-empty">
            <FileTextIcon size={24} />
            <h3>Chưa có khu vực nghiệp vụ được cấp quyền</h3>
            <p>Liên hệ quản trị viên để được cấp quyền truy cập.</p>
          </div>
        )}
      </section>
    </div>
  )
}
