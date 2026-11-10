import {
  ArrowRight,
  ChartColumn,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Store,
  Tags,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { IllustratedFigure } from '../../components/blocks/IllustratedFigure'
import { Button } from '../../components/shadcn/button'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
} from '../../app/navigation'
import { navigationIcons } from '../../app/navigationIcons'
import { useAuth } from '../authentication/useAuth'

/** Work areas shown on the desk, in sidebar order. */
const WORK_AREAS: { name: string; icon: LucideIcon }[] = [
  { name: 'Đại lý & Hàng hóa', icon: Store },
  { name: 'Giao dịch kho', icon: Warehouse },
  { name: 'Thu tiền & Công nợ', icon: Wallet },
  { name: 'Danh mục & Quy định', icon: Tags },
  { name: 'Quản trị & Lịch sử', icon: ShieldCheck },
]

const DESCRIPTIONS: Record<string, string> = {
  '/agencies': 'Tiếp nhận, cập nhật và ngừng hợp tác đại lý',
  '/products': 'Mặt hàng, đơn vị tính, giá và ngưỡng tồn',
  '/inventory': 'Tồn kho hiện tại và thẻ kho từng mặt hàng',
  '/agency-credit': 'Hạn mức nợ và số dư có của đại lý',
  '/stock-receipts': 'Lập và ghi sổ phiếu nhập hàng',
  '/stock-issues': 'Lập phiếu xuất hàng cho đại lý',
  '/sales-returns': 'Nhận hàng trả lại từ đại lý',
  '/stock-adjustments': 'Điều chỉnh chênh lệch tồn kho',
  '/stock-counts': 'Kiểm kê và đối chiếu tồn thực tế',
  '/receivables': 'Công nợ và lịch sử thanh toán đại lý',
  '/payment-receipts': 'Lập phiếu thu tiền đại lý',
  '/upfront-payments': 'Xác minh tiền trả ngay khi xuất hàng',
  '/credit-applications': 'Dùng dư có để bù trừ công nợ',
  '/online-payments': 'Theo dõi giao dịch thanh toán trực tuyến',
  '/refunds': 'Hoàn trả dư có cho đại lý',
  '/districts': 'Quận và số đại lý tối đa',
  '/agency-types': 'Loại đại lý và giới hạn nợ',
  '/units': 'Đơn vị tính của mặt hàng',
  '/business-rules': 'Quy định tiếp nhận và hệ số giá bán',
  '/users': 'Tài khoản, nhóm và trạng thái đăng nhập',
  '/user-groups': 'Nhóm tài khoản dùng để phân quyền',
  '/permissions': 'Cấp hoặc thu hồi quyền theo nhóm',
  '/audit-logs': 'Lịch sử thay đổi dữ liệu hệ thống',
  '/document-corrections': 'Sửa sai và hủy chứng từ đã ghi sổ',
}

export function HomePage() {
  const { user, hasPermission } = useAuth()
  const groups = WORK_AREAS.map((area) => ({
    ...area,
    items: (
      navigationGroups.find((group) => group.title === area.name)?.items ?? []
    ).filter(
      (item) =>
        !item.unavailable &&
        routePermissions[item.path] !== undefined &&
        allowsNavigation(hasPermission, routePermissions[item.path]),
    ),
  })).filter((area) => area.items.length > 0)
  const canDashboard = allowsNavigation(
    hasPermission,
    routePermissions['/dashboard'],
  )
  const canReports = allowsNavigation(
    hasPermission,
    routePermissions['/reports'],
  )
  const date = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border bg-card p-6 shadow-xs sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/5"
        />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:items-center">
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wider text-primary/80 uppercase">
                {date}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Bàn làm việc
              </h1>
              <p className="text-muted-foreground">
                Xin chào,{' '}
                <span className="font-medium text-foreground">
                  {user?.fullName || 'Người dùng'}
                </span>
                . Chọn nghiệp vụ bên dưới để bắt đầu.
              </p>
            </div>
            {(canDashboard || canReports) && (
              <nav className="flex flex-wrap gap-2" aria-label="Truy cập nhanh">
                {canDashboard && (
                  <Button asChild>
                    <Link to="/dashboard">
                      <LayoutDashboard aria-hidden="true" />
                      Xem tổng quan
                    </Link>
                  </Button>
                )}
                {canReports && (
                  <Button asChild variant="outline">
                    <Link to="/reports">
                      <ChartColumn aria-hidden="true" />
                      Mở báo cáo
                    </Link>
                  </Button>
                )}
              </nav>
            )}
          </div>
          <IllustratedFigure
            name="forklift.html"
            title="Minh họa tương tác: xe nâng nhập và xuất pallet hàng trên kệ kho"
            className="hidden h-[26rem] md:block"
          />
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="home-directory-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 id="home-directory-title" className="text-lg font-semibold">
            Nghiệp vụ
          </h2>
          <span className="text-sm text-muted-foreground">
            Chỉ hiện chức năng bạn được phép truy cập
          </span>
        </div>
        {groups.map((area) => (
          <div className="space-y-3" key={area.name}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <area.icon className="size-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                {area.name}
              </h3>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {area.items.map((item) => {
                const Icon = navigationIcons[item.path] ?? FileText
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className="group flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        aria-hidden="true"
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">
                          {item.label}
                        </span>
                        {DESCRIPTIONS[item.path] && (
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {DESCRIPTIONS[item.path]}
                          </span>
                        )}
                      </span>
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {groups.length === 0 && (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="Chưa có khu vực nghiệp vụ được cấp quyền"
            description="Liên hệ quản trị viên để được cấp quyền truy cập."
          />
        )}
      </section>
    </div>
  )
}
