import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { CreditApplicationsPage } from '../features/credit_applications/CreditApplicationsPage'
import * as apiModule from '../lib/api'
import type { UserResponse } from '../lib/types'

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

  const sampleApps = [
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
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      if (path.startsWith('/credit-applications')) {
        return {
          data: {
            items: sampleApps,
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
      expect(screen.getAllByText('POSTED').length).toBeGreaterThan(0)
      expect(screen.getAllByText('DRAFT').length).toBeGreaterThan(0)
    })
  })

  it('filters applications by search query and reloads', async () => {
    const fetchSpy = vi.spyOn(apiModule, 'apiFetch')

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

    const searchInput = screen.getByLabelText(/Tìm chứng từ/i, {
      selector: 'input',
    })
    fireEvent.change(searchInput, { target: { value: 'BT-602' } })

    const reloadBtn = screen.getByRole('button', { name: 'Tải lại' })
    fireEvent.click(reloadBtn)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=BT-602'),
        expect.any(Object),
      )
    })
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

    const createBtn = screen.getByRole('button', { name: 'Lập phiếu bù trừ' })
    fireEvent.click(createBtn)

    expect(
      screen.getByLabelText(/ID đại lý/i, { selector: 'input' }),
    ).toBeDefined()
    expect(
      screen.getByLabelText(/Số tiền \(VND nguyên\)/i, { selector: 'input' }),
    ).toBeDefined()

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByLabelText(/Số tiền \(VND nguyên\)/i)).toBeNull()
    })
  })
})
