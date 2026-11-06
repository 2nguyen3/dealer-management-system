import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { RefundsPage } from '../features/refunds/RefundsPage'
import * as apiModule from '../lib/api'
import type { UserResponse } from '../lib/types'

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

  const sampleRefunds = [
    {
      id: '801',
      code: 'HT-801',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      originDocumentId: '202',
      amount: '100000',
      totalAmount: '100000',
      paymentMethod: 'ONLINE',
      status: 'DRAFT',
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
      status: 'POSTED',
      reservedAmount: '0',
      refundedAmount: '50000',
      reason: 'Hoàn tiền mặt trực tiếp',
      businessDate: '2026-10-08',
      createdAt: '2026-10-08T02:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/refunds')) {
        return {
          data: {
            items: sampleRefunds,
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
      expect(screen.getAllByText('DRAFT').length).toBeGreaterThan(0)
      expect(screen.getAllByText('POSTED').length).toBeGreaterThan(0)
    })
  })

  it('filters refunds by search term and reloads', async () => {
    const fetchSpy = vi.spyOn(apiModule, 'apiFetch')

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

    const searchInput = screen.getByLabelText(/Tìm chứng từ/i, {
      selector: 'input',
    })
    fireEvent.change(searchInput, { target: { value: 'HT-802' } })

    const reloadBtn = screen.getByRole('button', { name: 'Tải lại' })
    fireEvent.click(reloadBtn)

    await waitFor(
      () => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('q=HT-802'),
          expect.any(Object),
        )
      },
      { timeout: 1000 },
    )
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

    const createBtn = screen.getByRole('button', {
      name: 'Lập yêu cầu hoàn tiền',
    })
    fireEvent.click(createBtn)

    expect(
      screen.getByLabelText(/ID phiếu thu nguồn đã ghi sổ/i, {
        selector: 'input',
      }),
    ).toBeDefined()
    expect(
      screen.getByLabelText(/Lý do hoàn tiền/i, { selector: 'input' }),
    ).toBeDefined()
    expect(
      screen.getByLabelText(/Số tiền \(VND nguyên\)/i, { selector: 'input' }),
    ).toBeDefined()

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByLabelText(/Lý do hoàn tiền/i)).toBeNull()
    })
  })
})
