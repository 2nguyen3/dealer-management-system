import {
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Search,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  PageIconContext,
  PageToolsContext,
} from '@/components/blocks/pageIconContext'
import { registerGuideNavigator } from '@/components/guide/notifyNextStep'
import { PageTransition } from '@/components/motion/Motion'
import { Avatar, AvatarFallback } from '@/components/shadcn/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/shadcn/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { Separator } from '@/components/shadcn/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/shadcn/sidebar'
import { TooltipProvider } from '@/components/shadcn/tooltip'
import { ModeToggle } from '@/components/theme/ModeToggle'
import { initials } from '../features/profile/profileModel'
import { ChangePasswordModal } from '../features/authentication/ChangePasswordModal'
import { GuideButton } from '../features/guide/GuideButton'
import { FavoriteButton } from '../features/portal/FavoriteButton'
import { useAuth } from '../features/authentication/useAuth'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
  sectionOf,
} from './navigation'
import { navigationIcons } from './navigationIcons'
import { SectionTabs } from './SectionTabs'
import { sidebarGroups } from './sidebarEntries'
import { getLocale, t } from '@/lib/i18n/core'
import { localeDirection } from '@/lib/i18n/locales'

function isRouteActive(pathname: string, path: string): boolean {
  return path === '/'
    ? pathname === '/'
    : pathname === path || pathname.startsWith(`${path}/`)
}

function WorkspaceSidebar({
  onChangePassword,
  onLogout,
  isLoggingOut,
}: {
  onChangePassword: () => void
  onLogout: () => void
  isLoggingOut: boolean
}) {
  const { user, hasPermission } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const search = query.trim().toLocaleLowerCase('vi')
  const groups = sidebarGroups(hasPermission, search)

  return (
    <Sidebar
      collapsible="icon"
      id="workspace-navigation"
      side={localeDirection(getLocale()) === 'rtl' ? 'right' : 'left'}
    >
      <SidebarHeader className="gap-3 px-2 pt-4">
        <NavLink
          to="/"
          aria-label={t('Agentra - Cổng quản lý')}
          data-testid="sidebar-brand"
          className="flex min-w-0 items-center gap-2 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {/* Fixed 32px square at the same inset as the menu buttons: it never
              shrinks, stretches or moves while the rail animates and sits
              centred in the 48px collapsed rail, like the nav icons. */}
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/95">
            <img
              src="/assets/brand/agentra-icon.png"
              alt=""
              width={28}
              height={28}
              className="aspect-square size-7 max-w-none shrink-0 object-contain"
            />
          </span>
          <span className="grid min-w-0 leading-tight whitespace-nowrap group-data-[collapsible=icon]:hidden">
            <span className="truncate text-base font-semibold text-white">
              Agentra
            </span>
            <span className="truncate text-[11px] tracking-wide text-sidebar-foreground/70">
              {t('Hệ thống phân phối')}
            </span>
          </span>
        </NavLink>
        <label className="relative group-data-[collapsible=icon]:hidden">
          <span className="sr-only">{t('Tìm chức năng')}</span>
          <Search className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-sidebar-foreground/60" />
          <SidebarInput
            type="search"
            placeholder={t('Tìm chức năng…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 border-sidebar-border bg-sidebar-accent ps-8 text-sidebar-accent-foreground placeholder:text-sidebar-foreground/50"
          />
        </label>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('Điều hướng nghiệp vụ')}>
          {groups.map((group) => (
            <SidebarGroup key={group.key}>
              <SidebarGroupLabel className="text-[11px] tracking-wider text-sidebar-foreground/55 uppercase">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.entries.map((item) => {
                    const Icon = item.icon
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.paths.some((path) =>
                            isRouteActive(pathname, path),
                          )}
                          tooltip={item.label}
                          className="data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground"
                        >
                          <NavLink
                            to={item.path}
                            end={item.path === '/'}
                            onClick={() => isMobile && setOpenMobile(false)}
                          >
                            {Icon && <Icon />}
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                        {item.unavailable && (
                          <SidebarMenuBadge className="text-[10px] text-sidebar-foreground/60">
                            {t('Sắp có')}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          {groups.length === 0 && (
            <p
              className="px-4 py-2 text-sm text-sidebar-foreground/70"
              role="status"
            >
              {t('Không tìm thấy chức năng phù hợp.')}
            </p>
          )}
        </nav>
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    aria-label={t('Tài khoản {fullName}', {
                      fullName: user.fullName,
                    })}
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-gradient-to-br from-[#5fd4ff] via-sidebar-primary to-[#1f4fd8] text-xs font-bold text-white">
                        {initials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid flex-1 text-start text-sm leading-tight">
                      <span className="truncate font-medium text-white">
                        {user.fullName}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/70">
                        {user.groupName}
                      </span>
                    </span>
                    <ChevronsUpDown className="ms-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side={isMobile ? 'bottom' : 'right'}
                  align="end"
                  className="min-w-56"
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid text-sm leading-tight">
                      <span className="font-medium">{user.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <NavLink
                      to="/profile"
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <UserRound />
                      {t('Hồ sơ cá nhân')}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onChangePassword}>
                    <KeyRound />
                    {t('Đổi mật khẩu')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isLoggingOut}
                    onSelect={onLogout}
                  >
                    <LogOut />
                    {isLoggingOut ? t('Đang thoát…') : t('Đăng xuất')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}

export function ShellLayout() {
  const { logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [logoutError, setLogoutError] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const current = navigationGroups
    .flatMap((group) => group.items.map((item) => ({ group, item })))
    .find(({ item }) => item.path === location.pathname)
  const pageIcon =
    location.pathname === '/profile'
      ? UserRound
      : (navigationIcons[current?.item.path ?? ''] ??
        Object.entries(navigationIcons)
          .filter(
            ([path]) => path !== '/' && isRouteActive(location.pathname, path),
          )
          .sort(([a], [b]) => b.length - a.length)[0]?.[1] ??
        null)
  const currentSection = sectionOf(location.pathname)
  const pageLabel =
    current?.item.label ??
    (location.pathname === '/profile'
      ? t('Hồ sơ cá nhân')
      : t('Không gian làm việc'))

  useEffect(() => {
    registerGuideNavigator(
      (to) => navigate(to),
      (to) =>
        allowsNavigation(
          hasPermission,
          routePermissions[to.split(/[?#]/)[0] ?? to],
        ),
    )
    return () => registerGuideNavigator(null)
  }, [navigate, hasPermission])
  const guidePath =
    current?.item.path ??
    Object.keys(navigationIcons)
      .filter((path) => isRouteActive(location.pathname, path))
      .sort((a, b) => b.length - a.length)[0] ??
    location.pathname

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(false)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError(true)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <a
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:start-2"
          href="#main-content"
        >
          {t('Đến nội dung chính')}
        </a>
        <WorkspaceSidebar
          onChangePassword={() => setIsPasswordModalOpen(true)}
          onLogout={() => void handleLogout()}
          isLoggingOut={isLoggingOut}
        />
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
            <SidebarTrigger
              className="-ms-1"
              aria-label={t('Mở hoặc thu gọn menu')}
            />
            <Separator orientation="vertical" className="me-1 !h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {current && (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      {currentSection?.label ?? current.group.title}
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                )}
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium">
                    {pageLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ms-auto flex items-center gap-1">
              <ModeToggle />
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="shell-content mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-4 outline-none md:p-6"
          >
            {logoutError && (
              <p
                role="alert"
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {t('Không thể đăng xuất. Vui lòng thử lại.')}
              </p>
            )}
            <PageIconContext.Provider value={pageIcon}>
              <PageToolsContext.Provider
                value={
                  <>
                    <GuideButton
                      key={guidePath}
                      path={guidePath}
                      title={pageLabel}
                    />
                    <FavoriteButton path={guidePath} title={pageLabel} />
                  </>
                }
              >
                <SectionTabs pathname={location.pathname} />
                <PageTransition key={location.pathname}>
                  <Outlet />
                </PageTransition>
              </PageToolsContext.Provider>
            </PageIconContext.Provider>
          </main>
        </SidebarInset>
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      </SidebarProvider>
    </TooltipProvider>
  )
}
