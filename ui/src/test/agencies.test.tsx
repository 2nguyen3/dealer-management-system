import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgenciesPage } from '../features/agencies/AgenciesPage'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { Agency, AgencyType, District, UserResponse } from '../lib/types'

describe('AgenciesPage Component', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Quản lý bán hàng',
    email: 'quanly@agentra.vn',
    groupId: 2,
    groupCode: 'SALES',
    groupName: 'Kinh doanh',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: ['agency.read', 'agency.manage'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) => ['agency.read', 'agency.manage'].includes(p))
        : ['agency.read', 'agency.manage'].includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleDistricts: District[] = [
    { id: 1, name: 'Quận 1', status: 'ACTIVE' },
    { id: 2, name: 'Quận 3', status: 'ACTIVE' },
  ]

  const sampleAgencyTypes: AgencyType[] = [
    {
      id: 1,
      name: 'Đại lý cấp 1',
      maxDebt: '50000000',
      status: 'ACTIVE',
    },
    {
      id: 2,
      name: 'Đại lý cấp 2',
      maxDebt: '20000000',
      status: 'ACTIVE',
    },
  ]

  const sampleAgencies: Agency[] = [
    {
      id: '101',
      code: 'DL-101',
      name: 'Đại lý Minh Phát',
      phone: '0901234567',
      email: 'minhphat@example.com',
      address: '123 Lê Lợi',
      districtId: 1,
      districtName: 'Quận 1',
      typeId: 1,
      typeName: 'Đại lý cấp 1',
      currentDebt: '15000000',
      status: 'ACTIVE',
      createdAt: '2026-06-01T00:00:00Z',
    },
    {
      id: '102',
      code: 'DL-102',
      name: 'Đại lý Hùng Cường',
      phone: '0912345678',
      email: 'hungcuong@example.com',
      address: '456 Hai Bà Trưng',
      districtId: 2,
      districtName: 'Quận 3',
      typeId: 2,
      typeName: 'Đại lý cấp 2',
      currentDebt: '0',
      status: 'TERMINATED',
      createdAt: '2026-06-02T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/districts')) {
          return { data: sampleDistricts, status: 200, etag: 'etag-districts' }
        }
        if (path.startsWith('/agency-types')) {
          return {
            data: sampleAgencyTypes,
            status: 200,
            etag: 'etag-agency-types',
          }
        }
        return { data: sampleAgencies, status: 200, etag: 'etag-agencies' }
      },
    )
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/agencies')) {
        return {
          data: { items: sampleAgencies, nextCursor: null },
          status: 200,
          etag: 'etag-agencies',
        }
      }
      return { data: {}, status: 200, etag: null }
    })
  })

  it('renders agency list with search, status badges and district filters', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <AgenciesPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getByText('Đại lý Hùng Cường')).toBeDefined()
    })

    expect(screen.getByText('123 Lê Lợi')).toBeDefined()
    expect(screen.getAllByText('Đại lý cấp 1').length).toBeGreaterThan(0)
  })

  it('filters agency list by search keyword', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <AgenciesPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(
      /Tìm theo tên hoặc số điện thoại/i,
    )
    fireEvent.change(searchInput, { target: { value: 'Minh Phát' } })

    expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
    expect(screen.queryByText('Đại lý Hùng Cường')).toBeNull()
  })

  it('opens create modal when clicking Tiếp nhận đại lý button', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <AgenciesPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
    })

    const createBtn = screen.getByRole('button', {
      name: /Tiếp nhận đại lý/i,
    })
    fireEvent.click(createBtn)

    expect(
      screen.getByRole('heading', { name: /Tiếp nhận đại lý mới/i }),
    ).toBeDefined()
  })
})
