import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { CreditApplicationsPage } from '../features/credit_applications/CreditApplicationsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { CreditApplication, UserResponse } from '../lib/types'

describe('CreditApplicationsPage Component', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Kế toán trưởng',
    email: 'ketoan@agentra.vn',
    groupId: 3,
    groupCode: 'ACCOUNTING',
    groupName: 'Kế toán',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: ['credit.apply', 'debt.read'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) => ['credit.apply', 'debt.read'].includes(p))
        : ['credit.apply', 'debt.read'].includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleApps: CreditApplication[] = [
    {
      id: '601',
      code: 'BT-601',
      kind: 'CREDIT_APPLICATION',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      status: 'POSTED',
      cashReceived: '0',
      creditUsedAmount: '200000',
      totalAmount: '200000',
      businessDate: '2026-10-06',
      note: 'Dùng dư có thanh toán nợ FIFO',
      createdAt: '2026-10-06T02:00:00Z',
    },
    {
      id: '602',
      code: 'BT-602',
      kind: 'CREDIT_APPLICATION',
      agencyId: '102',
      agencyName: 'Đại lý Toàn Thắng',
      status: 'DRAFT',
      cashReceived: '0',
      creditUsedAmount: '150000',
      totalAmount: '150000',
      businessDate: '2026-10-07',
      note: 'Phiếu nháp chờ đối soát',
      createdAt: '2026-10-07T02:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/agencies')) {
          return {
            data: [
              { id: '101', code: 'DL-101', name: 'Đại lý Minh Phát' },
              { id: '102', code: 'DL-102', name: 'Đại lý Toàn Thắng' },
            ],
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        if (path.startsWith('/credit-applications')) {
          return {
            data: sampleApps,
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        if (path.startsWith('/receivables/balances')) {
          return {
            data: [
              {
                agencyId: '101',
                agencyCode: 'DL-101',
                agencyName: 'Đại lý Minh Phát',
                currentDebt: '500000',
                maxDebt: '5000000',
                availableCredit: '300000',
                reservedCredit: '0',
              },
            ],
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
  })

  it('renders credit applications table with data', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <CreditApplicationsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Bù trừ dư có')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('BT-601')).toBeDefined()
      expect(screen.getByText('BT-602')).toBeDefined()
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getAllByText('Đã ghi sổ').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Bản nháp').length).toBeGreaterThan(0)
    })
  })

  it('filters applications by search query', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <CreditApplicationsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('BT-601')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(
      'Tìm theo mã phiếu, tên đại lý...',
    )
    fireEvent.change(searchInput, { target: { value: 'BT-602' } })

    expect(screen.queryByText('BT-601')).toBeNull()
    expect(screen.getByText('BT-602')).toBeDefined()
  })

  it('opens and closes the create modal', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <CreditApplicationsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('BT-601')).toBeDefined()
    })

    const createBtn = screen.getByText('Lập phiếu bù trừ')
    fireEvent.click(createBtn)

    expect(screen.getByText(/Đại lý áp dụng/)).toBeDefined()
    expect(screen.getByText(/Số tiền cấn trừ/)).toBeDefined()

    const cancelBtn = screen.getByText('Hủy bỏ')
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Số tiền cấn trừ/)).toBeNull()
    })
  })
})
