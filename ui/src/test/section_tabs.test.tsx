import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { routeLabel, sectionOf } from '../app/navigation'
import { SectionTabs } from '../app/SectionTabs'
import { ShellLayout } from '../app/ShellLayout'
import { sidebarGroups } from '../app/sidebarEntries'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import type { FunctionCode, UserResponse } from '../lib/types'

const user: UserResponse = {
  id: '1',
  fullName: 'Trần Thị Quản',
  email: 'admin@agentra.vn',
  groupId: 1,
  groupCode: 'ADMIN',
  groupName: 'Quản trị',
  status: 'ACTIVE',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
}

const ALL: FunctionCode[] = [
  'agency_type.manage',
  'unit.manage',
  'rules.manage',
  'users.manage',
  'groups.manage',
  'permissions.manage',
  'agency.read',
]

function auth(codes: readonly FunctionCode[]): AuthContextValue {
  return {
    user,
    allowedFunctions: [...codes],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (code) =>
      Array.isArray(code)
        ? code.some((one) => codes.includes(one))
        : codes.includes(code),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }
}

function renderShell(path: string, codes: readonly FunctionCode[]) {
  const page = (name: string) => <div>Trang {name}</div>
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth(codes)}>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route path="/" element={page('chủ')} />
            {[
              '/agency-types',
              '/units',
              '/business-rules',
              '/users',
              '/user-groups',
              '/permissions',
            ].map((route) => (
              <Route key={route} path={route} element={page(route)} />
            ))}
          </Route>
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

const sidebar = () =>
  screen.getByRole('navigation', { name: 'Điều hướng nghiệp vụ' })

describe('navigation sections', () => {
  it('maps member routes to their section and nothing else', () => {
    expect(sectionOf('/units')?.key).toBe('catalogue')
    expect(sectionOf('/business-rules')?.key).toBe('catalogue')
    expect(sectionOf('/permissions')?.key).toBe('access')
    expect(sectionOf('/users')?.key).toBe('access')
    expect(sectionOf('/agencies')).toBeUndefined()
    expect(sectionOf('/units/extra')).toBeUndefined()
  })
})

describe('sidebarGroups', () => {
  it('collapses each section into one entry opening its first allowed page', () => {
    const groups = sidebarGroups((code) => ALL.includes(code))
    const catalogue = groups.find((group) => group.key === 'catalogue')
    expect(catalogue?.entries.map((entry) => entry.label)).toEqual([
      'Danh mục & Quy định',
    ])
    expect(catalogue?.entries[0]?.path).toBe('/agency-types')
    const admin = groups.find((group) => group.key === 'admin')
    const labels = admin?.entries.map((entry) => entry.label) ?? []
    expect(labels).toContain('Người dùng & Phân quyền')
    expect(labels).not.toContain('Tài khoản người dùng')
    expect(labels).not.toContain('Nhóm người dùng')
    expect(labels).not.toContain('Phân quyền chức năng')
    expect(admin?.entries[0]?.paths).toEqual([
      '/users',
      '/user-groups',
      '/permissions',
    ])
  })

  it('links to the first page the user may open', () => {
    const groups = sidebarGroups((code) => code === 'permissions.manage')
    const access = groups
      .flatMap((group) => group.entries)
      .find((entry) => entry.label === 'Người dùng & Phân quyền')
    // /users needs users.manage; /user-groups accepts permissions.manage.
    expect(access?.path).toBe('/user-groups')
  })

  it('hides a section when no member page is allowed', () => {
    const groups = sidebarGroups((code) => code === 'agency.read')
    const labels = groups.flatMap((group) => group.entries).map((e) => e.label)
    expect(labels).not.toContain('Người dùng & Phân quyền')
    // agency.read alone opens /agency-types, so the catalogue entry stays.
    expect(labels).toContain('Danh mục & Quy định')
  })

  it('finds a merged entry by the name of a page behind it', () => {
    const allow = (code: FunctionCode) => ALL.includes(code)
    const hits = sidebarGroups(allow, 'đơn vị tính').flatMap(
      (group) => group.entries,
    )
    expect(hits.map((entry) => entry.label)).toEqual(['Danh mục & Quy định'])
    expect(sidebarGroups(allow, 'không có chức năng này')).toEqual([])
  })
})

describe('SectionTabs', () => {
  it('shows the allowed member pages as tabs with the current one active', () => {
    renderShell('/units', ALL)
    const tabs = screen.getByRole('navigation', {
      name: 'Danh mục & Quy định',
    })
    const links = within(tabs).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      routeLabel('/agency-types'),
      routeLabel('/units'),
      routeLabel('/business-rules'),
    ])
    expect(links[1]?.getAttribute('aria-current')).toBe('page')
    expect(links[0]?.getAttribute('aria-current')).toBeNull()
    expect(screen.getByText('Trang /units')).toBeDefined()
  })

  it('switches page when a tab is clicked and keeps the sidebar entry active', () => {
    renderShell('/users', ALL)
    const tabs = screen.getByRole('navigation', {
      name: 'Người dùng & Phân quyền',
    })
    fireEvent.click(
      within(tabs).getByRole('link', { name: 'Phân quyền chức năng' }),
    )
    expect(screen.getByText('Trang /permissions')).toBeDefined()
    const entry = within(sidebar()).getByRole('link', {
      name: 'Người dùng & Phân quyền',
    })
    expect(entry.closest('[data-active="true"]')).not.toBeNull()
    expect(within(sidebar()).queryByText('Tài khoản người dùng')).toBeNull()
  })

  it('hides tabs the user cannot open', () => {
    renderShell('/user-groups', ['groups.manage', 'permissions.manage'])
    const tabs = screen.getByRole('navigation', {
      name: 'Người dùng & Phân quyền',
    })
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Nhóm người dùng', 'Phân quyền chức năng'])
  })

  it('renders nothing for a single allowed tab or a route outside a section', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <AuthContext.Provider value={auth(['groups.manage'])}>
          <SectionTabs pathname="/user-groups" />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    expect(container.innerHTML).toBe('')
    rerender(
      <MemoryRouter>
        <AuthContext.Provider value={auth(ALL)}>
          <SectionTabs pathname="/agencies" />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    expect(container.innerHTML).toBe('')
  })
})
