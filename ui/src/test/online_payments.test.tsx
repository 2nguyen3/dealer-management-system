import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { OnlinePaymentsPage } from '../features/online_payments/OnlinePaymentsPage'
import * as apiModule from '../lib/api'
import type { UserResponse } from '../lib/types'

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

  const samplePayments = [
    {
      id: '1001',
      agencyId: '101',
      provider: 'VNPAY',
      merchantReference: 'REF-2026-001',
      providerTransactionId: 'TXN-001',
      receiptDocumentId: '501',
      paymentTime: '2026-10-10T10:05:00Z',
      amount: '500000',
      status: 'SUCCESS',
      checkoutUrl: 'https://sandbox.payment.vn/pay/001',
      createdAt: '2026-10-10T10:00:00Z',
      updatedAt: '2026-10-10T10:05:00Z',
    },
    {
      id: '1002',
      agencyId: '102',
      provider: 'VNPAY',
      merchantReference: 'REF-2026-002',
      providerTransactionId: null,
      receiptDocumentId: null,
      amount: '300000',
      status: 'PENDING',
      checkoutUrl: 'https://sandbox.vnpay.vn/pay/002',
      createdAt: '2026-10-11T14:00:00Z',
      updatedAt: '2026-10-11T14:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/online-payments')) {
        return {
          data: {
            items: samplePayments,
            pagination: { limit: 25, nextCursor: null, hasMore: false },
          },
          status: 200,
          etag: '"sample-etag"',
        } as unknown as apiModule.ApiResponse<unknown>
      }
      return {
        data: {
          items: [],
          pagination: { limit: 25, nextCursor: null, hasMore: false },
        },
        status: 200,
        etag: null,
      } as unknown as apiModule.ApiResponse<unknown>
    })
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
      expect(screen.getByText('#101')).toBeDefined()
      expect(screen.getAllByText('SUCCESS').length).toBeGreaterThan(0)
      expect(screen.getAllByText('PENDING').length).toBeGreaterThan(0)
    })
  })

  it('filters payments by search text and reloads', async () => {
    const fetchSpy = vi.spyOn(apiModule, 'apiFetch')

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

    const searchInput = screen.getByLabelText(/Mã tham chiếu/i, {
      selector: 'input',
    })
    fireEvent.change(searchInput, { target: { value: 'REF-2026-002' } })

    const reloadBtn = screen.getByRole('button', { name: 'Tải lại' })
    fireEvent.click(reloadBtn)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('merchantReference=REF-2026-002'),
        expect.any(Object),
      )
    })
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

    const createBtn = screen.getByRole('button', {
      name: 'Tạo thanh toán mới',
    })
    fireEvent.click(createBtn)

    expect(
      screen.getByLabelText(/ID đại lý thanh toán/i, { selector: 'input' }),
    ).toBeDefined()
    expect(
      screen.getByLabelText(/Số tiền thanh toán \(VND nguyên\)/i, {
        selector: 'input',
      }),
    ).toBeDefined()

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByLabelText(/ID đại lý thanh toán/i)).toBeNull()
    })
  })
})
