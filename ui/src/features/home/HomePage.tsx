import {
  ArrowUpRight,
  ChartColumn,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Sparkles,
  Star,
} from 'lucide-react'
import { useContext, useState } from 'react'
import { Link } from 'react-router'
import { PageToolsContext } from '../../components/blocks/pageIconContext'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/shadcn/tabs'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
} from '../../app/navigation'
import { navigationIcons } from '../../app/navigationIcons'
import { useAuth } from '../authentication/useAuth'
import { DESCRIPTIONS, WORK_AREAS } from '../portal/catalogue'
import { FavoritesDeck } from '../portal/FavoritesDeck'
import {
  isPortalTab,
  type PortalTab,
  readPortalTab,
  writePortalTab,
} from '../portal/portalTab'
import { type FavoritesApi, useFavorites } from '../portal/useFavorites'
import { currentIntl } from '@/lib/formatters'
import { t } from '@/lib/i18n/core'
import { cn } from '@/lib/utils'

/** Cổng quản lý (Portal): favourites deck and the business-function catalogue. */
export function HomePage() {
  const { user, hasPermission } = useAuth()
  const tools = useContext(PageToolsContext)
  const favorites = useFavorites()
  const userId = user?.id ?? ''
  const [tab, setTab] = useState<PortalTab>(
    () =>
      readPortalTab(userId) ??
      (favorites.favorites.length > 0 ? 'favorites' : 'functions'),
  )
  const groups = WORK_AREAS.map((area) => ({
    ...area,
    items: (
      navigationGroups.find((group) => group.key === area.key)?.items ?? []
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
  const date = new Intl.DateTimeFormat(currentIntl(), {
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t('Cổng quản lý')}
                </h1>
                {tools}
              </div>
              <p className="text-muted-foreground">
                {t('Xin chào,')}{' '}
                <span className="font-medium text-foreground">
                  {user?.fullName || t('Người dùng')}
                </span>
              </p>
            </StaggerItem>
            {groups.length > 0 && (
              <StaggerItem>
                <dl className="flex flex-wrap gap-6">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t('Chức năng')}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      <CountUp value={moduleCount} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t('Khu vực')}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      <CountUp value={groups.length} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t('Yêu thích')}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      <CountUp value={favorites.favorites.length} />
                    </dd>
                  </div>
                </dl>
              </StaggerItem>
            )}
            {(canDashboard || canReports) && (
              <StaggerItem>
                <nav
                  className="flex flex-wrap gap-2"
                  aria-label={t('Truy cập nhanh')}
                >
                  {canDashboard && (
                    <Button asChild>
                      <Link to="/dashboard">
                        <LayoutDashboard aria-hidden="true" />
                        {t('Xem tổng quan')}
                      </Link>
                    </Button>
                  )}
                  {canReports && (
                    <Button asChild variant="outline" className="bg-card/70">
                      <Link to="/reports">
                        <ChartColumn aria-hidden="true" />
                        {t('Mở báo cáo')}
                      </Link>
                    </Button>
                  )}
                </nav>
              </StaggerItem>
            )}
          </Stagger>
          <IllustratedFigure
            name="forklift.html"
            title={t(
              'Minh họa tương tác: xe nâng nhập và xuất pallet hàng trên kệ kho',
            )}
            className="hidden h-80 md:block"
          />
        </div>
      </section>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (!isPortalTab(value)) return
          setTab(value)
          writePortalTab(userId, value)
        }}
      >
        <TabsList aria-label={t('Cổng quản lý')}>
          <TabsTrigger value="favorites" data-testid="portal-tab-favorites">
            <Star aria-hidden="true" />
            {t('Yêu thích')}
          </TabsTrigger>
          <TabsTrigger value="functions" data-testid="portal-tab-functions">
            <LayoutGrid aria-hidden="true" />
            {t('Chức năng nghiệp vụ')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="favorites" className="pt-4">
          <FavoritesDeck favorites={favorites} />
        </TabsContent>
        <TabsContent value="functions" className="pt-4">
          <section className="space-y-6" aria-labelledby="home-directory-title">
            <h2 id="home-directory-title" className="text-lg font-semibold">
              {t('Nghiệp vụ')}
            </h2>
            {groups.map((area, areaIndex) => (
              <div className="space-y-3" key={area.key}>
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
                      <StaggerItem key={item.path} className="relative h-full">
                        <Item
                          asChild
                          variant="outline"
                          size="sm"
                          className="group h-full flex-nowrap bg-card pe-12 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
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
                        <StarToggle
                          path={item.path}
                          label={item.label}
                          favorites={favorites}
                        />
                      </StaggerItem>
                    )
                  })}
                </Stagger>
              </div>
            ))}
            {groups.length === 0 && (
              <EmptyState
                icon={<FileText className="size-6" />}
                title={t('Chưa có khu vực nghiệp vụ được cấp quyền')}
                description={t('Liên hệ quản trị viên để được cấp quyền.')}
              />
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Star on a catalogue card; sits outside the card link (no nested controls). */
function StarToggle({
  path,
  label,
  favorites,
}: {
  path: string
  label: string
  favorites: FavoritesApi
}) {
  if (!favorites.canFavorite(path)) return null
  const active = favorites.isFavorite(path)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute end-2 top-2 size-8"
      aria-pressed={active}
      aria-label={
        active
          ? t('Bỏ {page} khỏi yêu thích', { page: label })
          : t('Thêm {page} vào yêu thích', { page: label })
      }
      onClick={() => favorites.toggle(path)}
    >
      <Star
        aria-hidden="true"
        className={cn(active && 'fill-current text-amber-500')}
      />
    </Button>
  )
}
