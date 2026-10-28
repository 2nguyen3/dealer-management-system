import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { OnlinePaymentsPage } from '../features/online_payments/OnlinePaymentsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { OnlinePayment, UserResponse } from '../lib/types'

describe('OnlinePaymentsPage Component', () => {
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
    allowedFunctions: ['payments.online', 'debt.read'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) => ['payments.online', 'debt.read'].includes(p))
        : ['payments.online', 'debt.read'].includes(perm),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const samplePayments: OnlinePayment[] = [
    {
      id: 'pay-001',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      provider: 'SANDBOX',
      merchantReference: 'REF-2026-001',
      providerTransactionId: 'TXN-999',
      amount: '500000',
      status: 'SUCCESS',
      checkoutUrl: 'https://sandbox.payment.vn/pay/001',
      createdAt: '2026-10-10T10:00:00Z',
      updatedAt: '2026-10-10T10:05:00Z',
    },
    {
      id: 'pay-002',
      agencyId: '102',
      agencyName: 'Đại lý Toàn Thắng',
      provider: 'VNPAY',
      merchantReference: 'REF-2026-002',
      providerTransactionId: null,
      amount: '300000',
      status: 'PENDING',
      checkoutUrl: 'https://sandbox.vnpay.vn/pay/002',
      createdAt: '2026-10-11T14:00:00Z',
      updatedAt: '2026-10-11T14:00:00Z',
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
        if (path.startsWith('/online-payments')) {
          return {
            data: samplePayments,
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

  it('renders online payments table with records', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <OnlinePaymentsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Thanh toán trực tuyến')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('REF-2026-001')).toBeDefined()
      expect(screen.getByText('REF-2026-002')).toBeDefined()
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getAllByText('Thành công').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Đang chờ').length).toBeGreaterThan(0)
    })
  })

  it('filters payments by search text', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <OnlinePaymentsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('REF-2026-001')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(
      'Tìm theo mã giao dịch, đại lý...',
    )
    fireEvent.change(searchInput, { target: { value: 'REF-2026-002' } })

    expect(screen.queryByText('REF-2026-001')).toBeNull()
    expect(screen.getByText('REF-2026-002')).toBeDefined()
  })

  it('opens and closes create payment modal', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <OnlinePaymentsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('REF-2026-001')).toBeDefined()
    })

    const createBtn = screen.getByText('Tạo thanh toán mới')
    fireEvent.click(createBtn)

    expect(screen.getByText(/Đại lý thanh toán/)).toBeDefined()
    expect(screen.getByText(/Cổng thanh toán/)).toBeDefined()
    expect(screen.getByText(/Số tiền thanh toán/)).toBeDefined()

    const cancelBtn = screen.getByText('Hủy bỏ')
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Cổng thanh toán/)).toBeNull()
    })
  })
})
