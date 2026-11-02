import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { UserResponse } from '../lib/types'

describe('DashboardPage Component', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Giám đốc kinh doanh',
    email: 'director@agentra.vn',
    groupId: 1,
    groupCode: 'ADMIN',
    groupName: 'Ban giám đốc',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: [
      'agency.read',
      'inventory.read',
      'sales.read',
      'debt.read',
      'product.manage',
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
      currentDebt: '1500000',
      status: 'ACTIVE',
      districtName: 'Quận 1',
    },
    {
      id: '102',
      code: 'DL-102',
      name: 'Đại lý Toàn Thắng',
      currentDebt: '800000',
      status: 'ACTIVE',
      districtName: 'Quận 3',
    },
  ]

  const sampleProducts = [
    {
      id: 'p1',
      code: 'MH-01',
      name: 'Nước khoáng đóng chai',
      currentStock: '5',
      minStockAlert: '20',
      unitName: 'Thùng',
    },
  ]

  const sampleIssues = [
    {
      id: 'iss-1',
      code: 'PX-201',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      status: 'POSTED',
      totalAmount: '2500000',
      createdAt: '2026-10-15T00:00:00Z',
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

  it('renders dashboard metrics and perspective cards', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <DashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Bảng điều khiển tổng quan')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Đại lý hoạt động')).toBeDefined()
      expect(screen.getByText('Doanh số kỳ này')).toBeDefined()
      expect(screen.getByText('Tổng dư nợ đại lý')).toBeDefined()
      expect(screen.getByText('Cảnh báo tồn kho')).toBeDefined()

      // Perspective tables
      expect(screen.getByText('Top đại lý có dư nợ cao nhất')).toBeDefined()
      expect(
        screen.getByText('Mặt hàng chạm ngưỡng tồn tối thiểu'),
      ).toBeDefined()
      expect(screen.getByText('Phiếu xuất hàng gần đây')).toBeDefined()
    })
  })
})
