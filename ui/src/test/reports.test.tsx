import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { ReportsPage } from '../features/reports/ReportsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { UserResponse } from '../lib/types'

describe('ReportsPage Component', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Quản lý kinh doanh',
    email: 'quanly@agentra.vn',
    groupId: 1,
    groupCode: 'MANAGER',
    groupName: 'Quản lý',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: [
      'reports.read',
      'sales.read',
      'debt.read',
      'inventory.read',
    ],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleAgencies = [
    {
      id: '101',
      code: 'DL-101',
      name: 'Đại lý Minh Phát',
      agencyTypeName: 'Loại 1',
      currentDebt: '2000000',
    },
    {
      id: '102',
      code: 'DL-102',
      name: 'Đại lý Toàn Thắng',
      agencyTypeName: 'Loại 2',
      currentDebt: '500000',
    },
  ]

  const sampleProducts = [
    {
      id: 'p1',
      code: 'MH-01',
      name: 'Nước ngọt lon',
      unitName: 'Lon',
      currentStock: '150',
    },
    {
      id: 'p2',
      code: 'MH-02',
      name: 'Bánh quy bơ',
      unitName: 'Hộp',
      currentStock: '45',
    },
  ]

  const sampleIssues = [
    {
      id: 'iss-1',
      code: 'PX-101',
      agencyId: '101',
      status: 'POSTED',
      totalAmount: '1200000',
      createdAt: '2026-10-05T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/agencies')) {
          return {
            data: sampleAgencies,
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        if (path.startsWith('/products')) {
          return {
            data: sampleProducts,
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        if (path.startsWith('/stock-issues')) {
          return {
            data: sampleIssues,
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        return {
          data: [],
          status: 200,
          headers: new Headers(),
        } as unknown as apiModule.ApiResponse<unknown>
      },
    )
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      data: null,
      status: 404,
      etag: null,
    })
  })

  it('renders sales report BM6.1 tab by default', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ReportsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Báo cáo kinh doanh')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('BÁO CÁO DOANH SỐ ĐẠI LÝ (BM6.1)')).toBeDefined()
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getByText('DL-101')).toBeDefined()
      expect(screen.getAllByText('1.200.000 ₫').length).toBeGreaterThan(0)
    })
  })

  it('switches between tabs: Debt BM6.2 and Inventory', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <ReportsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    // Switch to Debt tab
    const debtTabBtn = screen.getByText('Công nợ (BM6.2)')
    fireEvent.click(debtTabBtn)

    await waitFor(() => {
      expect(screen.getByText('BÁO CÁO CÔNG NỢ ĐẠI LÝ (BM6.2)')).toBeDefined()
      expect(screen.getByText('2.000.000 ₫')).toBeDefined()
    })

    // Switch to Inventory tab
    const invTabBtn = screen.getByText('Xuất nhập tồn')
    fireEvent.click(invTabBtn)

    await waitFor(() => {
      expect(screen.getByText('BÁO CÁO XUẤT NHẬP TỒN HÀNG HÓA')).toBeDefined()
      expect(screen.getByText('Nước ngọt lon')).toBeDefined()
      expect(screen.getByText('Bánh quy bơ')).toBeDefined()
    })
  })
})
