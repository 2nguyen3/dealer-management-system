import {
  ArrowUpRight,
  ChartColumn,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Store,
  Tags,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { IllustratedFigure } from '../../components/blocks/IllustratedFigure'
import { CountUp, Stagger, StaggerItem } from '../../components/motion/Motion'
import { Badge } from '../../components/shadcn/badge'
import { Button } from '../../components/shadcn/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '../../components/shadcn/item'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
} from '../../app/navigation'
import { navigationIcons } from '../../app/navigationIcons'
import { useAuth } from '../authentication/useAuth'

/** Work areas shown on the desk, in sidebar order, each with a fixed accent slot. */
const WORK_AREAS: { name: string; icon: LucideIcon; color: string }[] = [
  { name: 'Đại lý & Hàng hóa', icon: Store, color: 'var(--chart-1)' },
  { name: 'Giao dịch kho', icon: Warehouse, color: 'var(--chart-2)' },
  { name: 'Thu tiền & Công nợ', icon: Wallet, color: 'var(--chart-3)' },
  { name: 'Danh mục & Quy định', icon: Tags, color: 'var(--chart-5)' },
  { name: 'Quản trị & Lịch sử', icon: ShieldCheck, color: 'var(--chart-7)' },
]

/** One-line hints under each tile; kept short on purpose. */
const DESCRIPTIONS: Record<string, string> = {
  '/agencies': 'Tiếp nhận, cập nhật đại lý',
  '/products': 'Mặt hàng, giá, ngưỡng tồn',
  '/inventory': 'Tồn hiện tại, thẻ kho',
  '/agency-credit': 'Hạn mức nợ, số dư có',
  '/stock-receipts': 'Nhập hàng vào kho',
  '/stock-issues': 'Xuất hàng cho đại lý',
  '/sales-returns': 'Nhận hàng trả lại',
  '/stock-adjustments': 'Tăng/giảm tồn kho',
  '/stock-counts': 'Đối chiếu tồn thực tế',
  '/receivables': 'Công nợ, lịch sử thanh toán',
  '/payment-receipts': 'Thu tiền đại lý',
  '/upfront-payments': 'Xác minh trả ngay',
  '/credit-applications': 'Dư có bù công nợ',
  '/online-payments': 'Giao dịch trực tuyến',
  '/refunds': 'Hoàn trả dư có',
  '/agency-types': 'Loại đại lý, giới hạn nợ',
  '/units': 'Đơn vị tính',
  '/business-rules': 'Quy định, hệ số giá bán',
  '/users': 'Tài khoản, nhóm và trạng thái',
  '/user-groups': 'Nhóm để phân quyền',
  '/permissions': 'Cấp/thu hồi quyền',
  '/audit-logs': 'Lịch sử thay đổi dữ liệu',
  '/document-corrections': 'Sửa sai, hủy chứng từ',
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
  const moduleCount = groups.reduce((sum, area) => sum + area.items.length, 0)
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
      <section className="bg-water relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs sm:p-7">
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center">
          <Stagger className="flex flex-col gap-5" step={0.08}>
            <StaggerItem className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {date}
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Bàn làm việc
              </h1>
              <p className="text-muted-foreground">
                Xin chào,{' '}
                <span className="font-medium text-foreground">
                  {user?.fullName || 'Người dùng'}
                </span>
              </p>
            </StaggerItem>
            {groups.length > 0 && (
              <StaggerItem>
                <dl className="flex flex-wrap gap-6">
                  <div>
                    <dt className="text-xs text-muted-foreground">Chức năng</dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      <CountUp value={moduleCount} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Khu vực</dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      <CountUp value={groups.length} />
                    </dd>
                  </div>
                </dl>
              </StaggerItem>
            )}
            {(canDashboard || canReports) && (
              <StaggerItem>
                <nav
                  className="flex flex-wrap gap-2"
                  aria-label="Truy cập nhanh"
                >
                  {canDashboard && (
                    <Button asChild>
                      <Link to="/dashboard">
                        <LayoutDashboard aria-hidden="true" />
                        Xem tổng quan
                      </Link>
                    </Button>
                  )}
                  {canReports && (
                    <Button asChild variant="outline" className="bg-card/70">
                      <Link to="/reports">
                        <ChartColumn aria-hidden="true" />
                        Mở báo cáo
                      </Link>
                    </Button>
                  )}
                </nav>
              </StaggerItem>
            )}
          </Stagger>
          <IllustratedFigure
            name="forklift.html"
            title="Minh họa tương tác: xe nâng nhập và xuất pallet hàng trên kệ kho"
            className="hidden h-80 md:block"
          />
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="home-directory-title">
        <h2 id="home-directory-title" className="text-lg font-semibold">
          Nghiệp vụ
        </h2>
        {groups.map((area, areaIndex) => (
          <div className="space-y-3" key={area.name}>
            <div className="flex items-center gap-2">
              <span
                className="flex size-6 items-center justify-center rounded-md"
                style={{
                  background: `color-mix(in oklab, ${area.color} 16%, transparent)`,
                  color: area.color,
                }}
                aria-hidden="true"
              >
                <area.icon className="size-3.5" />
              </span>
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {area.name}
              </h3>
              <Badge variant="secondary" className="tabular-nums">
                {area.items.length}
              </Badge>
            </div>
            <Stagger
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              delay={areaIndex * 0.06}
              step={0.04}
            >
              {area.items.map((item) => {
                const Icon = navigationIcons[item.path] ?? FileText
                return (
                  <StaggerItem key={item.path} className="h-full">
                    <Item
                      asChild
                      variant="outline"
                      size="sm"
                      className="group h-full flex-nowrap bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <Link to={item.path}>
                        <ItemMedia
                          className="size-10 rounded-xl transition-transform duration-200 group-hover:scale-105"
                          style={{
                            background: `color-mix(in oklab, ${area.color} 14%, transparent)`,
                            color: area.color,
                          }}
                          aria-hidden="true"
                        >
                          <Icon className="size-5" />
                        </ItemMedia>
                        <ItemContent className="min-w-0 gap-0.5">
                          <ItemTitle className="w-full truncate">
                            {item.label}
                          </ItemTitle>
                          {DESCRIPTIONS[item.path] && (
                            <ItemDescription className="line-clamp-1 text-xs">
                              {DESCRIPTIONS[item.path]}
                            </ItemDescription>
                          )}
                        </ItemContent>
                        <ItemActions>
                          <ArrowUpRight
                            className="size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </ItemActions>
                      </Link>
                    </Item>
                  </StaggerItem>
                )
              })}
            </Stagger>
          </div>
        ))}
        {groups.length === 0 && (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="Chưa có khu vực nghiệp vụ được cấp quyền"
            description="Liên hệ quản trị viên để được cấp quyền."
          />
        )}
      </section>
    </div>
  )
}
