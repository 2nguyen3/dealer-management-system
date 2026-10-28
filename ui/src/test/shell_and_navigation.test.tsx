import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '../app/ProtectedRoute'
import { ShellLayout } from '../app/ShellLayout'
import { clearSession, saveSession } from '../features/authentication/session'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import type { TokenResponse, UserResponse } from '../lib/types'

describe('Shell Layout & Protected Routes', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Lê Văn B',
    email: 'sales@agentra.vn',
    groupId: 2,
    groupCode: 'SALES',
    groupName: 'Kinh doanh',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockToken: TokenResponse = {
    accessToken: 'valid-sales-token',
    tokenType: 'Bearer',
    expiresAt: '2026-10-23T12:00:00Z',
    refreshToken: 'valid-refresh-token',
    refreshExpiresAt: '2026-10-30T12:00:00Z',
    user: mockUser,
  }

  beforeEach(() => {
    clearSession()
    vi.restoreAllMocks()
  })

  it('redirects unauthenticated user to /login with returnTo param', () => {
    const unauthContext: AuthContextValue = {
      user: null,
      allowedFunctions: [],
      isAuthenticated: false,
      isLoading: false,
      hasPermission: () => false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    }

    render(
      <MemoryRouter initialEntries={['/agencies']}>
        <AuthContext.Provider value={unauthContext}>
          <Routes>
            <Route
              path="/agencies"
              element={
                <ProtectedRoute requiredPermission="agency.read">
                  <div>Nội dung đại lý</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Trang đăng nhập</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Trang đăng nhập')).toBeDefined()
    expect(screen.queryByText('Nội dung đại lý')).toBeNull()
  })

  it('renders AccessDeniedPage when user lacks required permission', () => {
    saveSession(mockToken)

    const mockAuthContext: AuthContextValue = {
      user: mockUser,
      allowedFunctions: ['agency.read'], // has agency.read, but NOT users.manage
      isAuthenticated: true,
      isLoading: false,
      hasPermission: (perm) => {
        if (Array.isArray(perm)) return perm.includes('agency.read')
        return perm === 'agency.read'
      },
      login: vi.fn(),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    }

    render(
      <MemoryRouter initialEntries={['/users']}>
        <AuthContext.Provider value={mockAuthContext}>
          <Routes>
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission="users.manage">
                  <div>Quản trị tài khoản</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Không có quyền truy cập')).toBeDefined()
    expect(screen.queryByText('Quản trị tài khoản')).toBeNull()
  })

  it('renders children when authenticated and has required permission', () => {
    saveSession(mockToken)

    const mockAuthContext: AuthContextValue = {
      user: mockUser,
      allowedFunctions: ['agency.read'],
      isAuthenticated: true,
      isLoading: false,
      hasPermission: (perm) => {
        if (Array.isArray(perm)) return perm.includes('agency.read')
        return perm === 'agency.read'
      },
      login: vi.fn(),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    }

    render(
      <MemoryRouter initialEntries={['/agencies']}>
        <AuthContext.Provider value={mockAuthContext}>
          <Routes>
            <Route
              path="/agencies"
              element={
                <ProtectedRoute requiredPermission="agency.read">
                  <div>Nội dung hồ sơ đại lý</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Nội dung hồ sơ đại lý')).toBeDefined()
  })

  it('filters navigation in ShellLayout strictly based on allowedFunctions without management bypass', () => {
    saveSession(mockToken)

    // User only has agency.read permission
    const mockAuthContext: AuthContextValue = {
      user: mockUser,
      allowedFunctions: ['agency.read'],
      isAuthenticated: true,
      isLoading: false,
      hasPermission: (perm) => {
        if (Array.isArray(perm)) return perm.includes('agency.read')
        return perm === 'agency.read'
      },
      login: vi.fn(),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={mockAuthContext}>
          <Routes>
            <Route element={<ShellLayout />}>
              <Route path="/" element={<div>Trang chủ</div>} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    // User info displayed
    expect(screen.getByText('Lê Văn B')).toBeDefined()
    expect(screen.getByText('Kinh doanh')).toBeDefined()

    // Agency link is visible
    expect(screen.getByText('Hồ sơ đại lý')).toBeDefined()

    // Links requiring other permissions are NOT in the document
    expect(screen.queryByText('Tài khoản người dùng')).toBeNull()
    expect(screen.queryByText('Nhật ký hệ thống')).toBeNull()
    expect(screen.queryByText('Thay đổi quy định')).toBeNull()
  })

  it('triggers logout on button click', async () => {
    saveSession(mockToken)
    const logoutMock = vi.fn().mockResolvedValue(undefined)

    const mockAuthContext: AuthContextValue = {
      user: mockUser,
      allowedFunctions: ['agency.read'],
      isAuthenticated: true,
      isLoading: false,
      hasPermission: () => true,
      login: vi.fn(),
      logout: logoutMock,
      refreshProfile: vi.fn(),
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={mockAuthContext}>
          <Routes>
            <Route element={<ShellLayout />}>
              <Route path="/" element={<div>Trang chủ</div>} />
            </Route>
            <Route path="/login" element={<div>Đã đăng xuất</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    const logoutBtn = screen.getByRole('button', { name: /Đăng xuất/i })
    fireEvent.click(logoutBtn)

    expect(logoutMock).toHaveBeenCalled()
  })
})
