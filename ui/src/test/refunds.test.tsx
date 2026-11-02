import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { RefundsPage } from '../features/refunds/RefundsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { Refund, UserResponse } from '../lib/types'

describe('RefundsPage Component', () => {
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
    allowedFunctions: ['cash.refund.prepare', 'cash.refund.post', 'debt.read'],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) =>
            ['cash.refund.prepare', 'cash.refund.post', 'debt.read'].includes(
              p,
            ),
          )
        : ['cash.refund.prepare', 'cash.refund.post', 'debt.read'].includes(
            perm,
          ),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

  const sampleRefunds: Refund[] = [
    {
      id: '801',
      code: 'HT-801',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      originDocumentId: '202',
      amount: '100000',
      totalAmount: '100000',
      paymentMethod: 'ONLINE',
      status: 'SUBMITTED',
      reservedAmount: '100000',
      refundedAmount: '0',
      reason: 'Hoàn tiền dư sau trả hàng',
      businessDate: '2026-10-07',
      createdAt: '2026-10-07T02:00:00Z',
    },
    {
      id: '802',
      code: 'HT-802',
      agencyId: '102',
      agencyName: 'Đại lý Toàn Thắng',
      originDocumentId: '203',
      amount: '50000',
      totalAmount: '50000',
      paymentMethod: 'CASH',
      status: 'PAID',
      reservedAmount: '0',
      refundedAmount: '50000',
      reason: 'Hoàn tiền mặt trực tiếp',
      businessDate: '2026-10-08',
      createdAt: '2026-10-08T02:00:00Z',
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
        if (path.startsWith('/refunds')) {
          return {
            data: sampleRefunds,
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
                currentDebt: '0',
                maxDebt: '5000000',
                availableCredit: '200000',
                reservedCredit: '100000',
              },
            ],
            status: 200,
            headers: new Headers(),
          } as unknown as apiModule.ApiResponse<unknown>
        }
        if (path.startsWith('/agency-credit/lots')) {
          return {
            data: [
              {
                id: 'lot-1',
                agencyId: '101',
                sourceDocumentId: '202',
                sourceDocumentCode: 'PT-202',
                availableAmount: '200000',
                balance: '200000',
                createdAt: '2026-10-01T00:00:00Z',
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

  it('renders refunds table with records', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <RefundsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Hoàn tiền đại lý')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('HT-801')).toBeDefined()
      expect(screen.getByText('HT-802')).toBeDefined()
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getAllByText('Đã giữ chỗ quỹ').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Đã hoàn tiền').length).toBeGreaterThan(0)
    })
  })

  it('filters refunds by search term', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <RefundsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('HT-801')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(
      'Tìm theo mã phiếu, lý do, đại lý...',
    )
    fireEvent.change(searchInput, { target: { value: 'HT-802' } })

    expect(screen.queryByText('HT-801')).toBeNull()
    expect(screen.getByText('HT-802')).toBeDefined()
  })

  it('opens and closes create refund modal', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <RefundsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('HT-801')).toBeDefined()
    })

    const createBtn = screen.getByText('Lập yêu cầu hoàn tiền')
    fireEvent.click(createBtn)

    expect(screen.getByText(/Đại lý yêu cầu hoàn/)).toBeDefined()
    expect(screen.getByText(/Phương thức chi hoàn/)).toBeDefined()
    expect(screen.getByText(/Lý do hoàn tiền/)).toBeDefined()

    const cancelBtn = screen.getByText('Hủy bỏ')
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText(/Lý do hoàn tiền/)).toBeNull()
    })
  })
})
