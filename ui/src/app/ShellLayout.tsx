import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import {
  KeyIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  XIcon,
} from '../components/ui/Icons'
import { ChangePasswordModal } from '../features/authentication/ChangePasswordModal'
import { useAuth } from '../features/authentication/useAuth'
import {
  allowsNavigation,
  navigationGroups,
  routePermissions,
} from './navigation'

export function ShellLayout() {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [navigationSearch, setNavigationSearch] = useState('')
  const [logoutError, setLogoutError] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const pageLabel =
    navigationGroups
      .flatMap((group) => group.items)
      .find((item) => item.path === location.pathname)?.label ||
    'Không gian làm việc'

  const closeMobileNavigation = () => {
    setIsMobileNavOpen(false)
    menuButton.current?.focus()
  }

  useEffect(() => {
    if (!isMobileNavOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    searchInput.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsMobileNavOpen(false)
        menuButton.current?.focus()
      }
      if (event.key !== 'Tab') return
      const controls = sidebar.current?.querySelectorAll<HTMLElement>(
        'a[href], input, button',
      )
      const first = controls?.[0]
      const last = controls?.[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
    }
  }, [isMobileNavOpen])

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

  const search = navigationSearch.trim().toLocaleLowerCase('vi')
  const visibleGroups = navigationGroups
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
    <div className="shell-container">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="shell-header">
        <div className="shell-header-left">
          <button
            ref={menuButton}
            type="button"
            className="shell-mobile-toggle"
            onClick={() => setIsMobileNavOpen((value) => !value)}
            aria-label={isMobileNavOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={isMobileNavOpen}
            aria-controls="workspace-navigation"
          >
            {isMobileNavOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
          </button>
          <span className="shell-mobile-brand">
            <img
              className="app-logo app-logo--mobile"
              src="/assets/brand/agentra-icon.png"
              alt="Agentra"
            />
          </span>
          <div className="shell-breadcrumb">
            <span>Không gian làm việc</span>
            <strong>{pageLabel}</strong>
          </div>
        </div>
        <div className="shell-header-right">
          {user && (
            <div className="shell-user-info">
              <div className="shell-user-avatar" aria-hidden="true">
                {user.fullName.trim().charAt(0).toLocaleUpperCase('vi')}
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shell-action-btn"
              onClick={() => setIsPasswordModalOpen(true)}
              title="Đổi mật khẩu"
              aria-label="Đổi mật khẩu"
            >
              <KeyIcon size={16} />
              <span className="shell-action-label">Đổi mật khẩu</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shell-action-btn shell-action-btn--logout"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOutIcon size={16} />
              <span className="shell-action-label">
                {isLoggingOut ? 'Đang thoát…' : 'Đăng xuất'}
              </span>
            </Button>
          </div>
        </div>
      </header>
      <div className="shell-body">
        <aside
          ref={sidebar}
          id="workspace-navigation"
          className={`shell-sidebar ${isMobileNavOpen ? 'shell-sidebar--open' : ''}`}
        >
          <div className="sidebar-brand">
            <NavLink
              to="/"
              className="shell-logo"
              aria-label="Agentra - Bàn làm việc"
            >
              <img
                className="app-logo app-logo--sidebar"
                src="/assets/brand/agentra-white.png"
                alt="Agentra"
              />
            </NavLink>
            <span>HỆ THỐNG PHÂN PHỐI</span>
          </div>
          <label className="nav-search">
            <span className="sr-only">Tìm chức năng</span>
            <SearchIcon size={16} />
            <input
              ref={searchInput}
              type="search"
              placeholder="Tìm chức năng…"
              value={navigationSearch}
              onChange={(event) => setNavigationSearch(event.target.value)}
            />
          </label>
          <nav className="shell-nav" aria-label="Điều hướng nghiệp vụ">
            {visibleGroups.map((group) => (
              <div key={group.title} className="shell-nav-group">
                <div className="shell-nav-group-title">{group.title}</div>
                <div className="shell-nav-group-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        `shell-nav-link ${isActive ? 'shell-nav-link--active' : ''}`
                      }
                      onClick={() => {
                        if (isMobileNavOpen) closeMobileNavigation()
                      }}
                    >
                      <span>{item.label}</span>
                      {item.unavailable && (
                        <span className="nav-soon">Sắp có</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            {visibleGroups.length === 0 && (
              <p className="nav-no-results" role="status">
                Không tìm thấy chức năng phù hợp.
              </p>
            )}
          </nav>
        </aside>
        {isMobileNavOpen && (
          <button
            type="button"
            className="shell-sidebar-backdrop"
            onClick={closeMobileNavigation}
            aria-label="Đóng điều hướng"
            tabIndex={-1}
          />
        )}
        <main className="shell-content" id="main-content" tabIndex={-1}>
          {logoutError && (
            <p role="alert" className="alert alert--error">
              Không thể đăng xuất. Vui lòng thử lại.
            </p>
          )}
          <Outlet />
        </main>
      </div>
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  )
}
