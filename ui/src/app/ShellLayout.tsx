import { ChevronsUpDown, KeyRound, LogOut, Search } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
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
import { ChangePasswordModal } from '../features/authentication/ChangePasswordModal'
import { useAuth } from '../features/authentication/useAuth'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
} from './navigation'
import { navigationIcons } from './navigationIcons'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const last = parts.at(-1) ?? ''
  return last.charAt(0).toLocaleUpperCase('vi') || '?'
}

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
  const groups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          allowsNavigation(hasPermission, routePermissions[item.path]) &&
          (!search ||
            `${group.title} ${item.label}`
              .toLocaleLowerCase('vi')
              .includes(search)),
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible="icon" id="workspace-navigation">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <NavLink
          to="/"
          aria-label="Agentra - Bàn làm việc"
          className="flex items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <img
            src="/assets/brand/agentra-icon.png"
            alt=""
            className="size-8 shrink-0 rounded-md bg-white/95 p-0.5"
          />
          <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-base font-semibold text-white">Agentra</span>
            <span className="text-[11px] tracking-wide text-sidebar-foreground/70">
              Hệ thống phân phối
            </span>
          </span>
        </NavLink>
        <label className="relative group-data-[collapsible=icon]:hidden">
          <span className="sr-only">Tìm chức năng</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-sidebar-foreground/60" />
          <SidebarInput
            type="search"
            placeholder="Tìm chức năng…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 border-sidebar-border bg-sidebar-accent pl-8 text-sidebar-accent-foreground placeholder:text-sidebar-foreground/50"
          />
        </label>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Điều hướng nghiệp vụ">
          {groups.map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel className="text-[11px] tracking-wider text-sidebar-foreground/55 uppercase">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = navigationIcons[item.path]
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isRouteActive(pathname, item.path)}
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
                            Sắp có
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
              Không tìm thấy chức năng phù hợp.
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
                    aria-label={`Tài khoản ${user.fullName}`}
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
                        {initials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium text-white">
                        {user.fullName}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/70">
                        {user.groupName}
                      </span>
                    </span>
                    <ChevronsUpDown className="ml-auto size-4" />
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
                  <DropdownMenuItem onSelect={onChangePassword}>
                    <KeyRound />
                    Đổi mật khẩu
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isLoggingOut}
                    onSelect={onLogout}
                  >
                    <LogOut />
                    {isLoggingOut ? 'Đang thoát…' : 'Đăng xuất'}
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
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [logoutError, setLogoutError] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const current = navigationGroups
    .flatMap((group) => group.items.map((item) => ({ group, item })))
    .find(({ item }) => item.path === location.pathname)
  const pageLabel = current?.item.label ?? 'Không gian làm việc'

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
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          href="#main-content"
        >
          Đến nội dung chính
        </a>
        <WorkspaceSidebar
          onChangePassword={() => setIsPasswordModalOpen(true)}
          onLogout={() => void handleLogout()}
          isLoggingOut={isLoggingOut}
        />
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
            <SidebarTrigger
              className="-ml-1"
              aria-label="Mở hoặc thu gọn menu"
            />
            <Separator orientation="vertical" className="mr-1 !h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {current && (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      {current.group.title}
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
                Không thể đăng xuất. Vui lòng thử lại.
              </p>
            )}
            <Outlet />
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
