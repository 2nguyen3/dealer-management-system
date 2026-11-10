import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
      expect(
        screen.getAllByText('Nháp', { ignore: 'option' }).length,
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByText('Đã ghi sổ', { ignore: 'option' }).length,
      ).toBeGreaterThan(0)
    })
    expect(screen.queryByText('DRAFT')).toBeNull()
    const row = screen.getByText('HT-801').closest('tr')!
    expect(within(row).getByText('Trực tuyến (VNPAY)')).toBeDefined()
    expect(within(row).getByText('07/10/2026')).toBeDefined()
    expect(within(row).getByText('100.000 ₫').className).toContain(
      'cell-number',
    )
    expect(
      within(row)
        .getByRole('button', { name: 'Chi tiết HT-801' })
        .textContent?.trim(),
    ).toBe('Chi tiết')
  })

  it('shows refund detail amounts and attempt state in Vietnamese', async () => {
    const fetchSpy = vi.spyOn(apiModule, 'apiFetch')
    const list = fetchSpy.getMockImplementation()!
    fetchSpy.mockImplementation(async (path, options) =>
      path === '/refunds/801'
        ? {
            data: {
              id: '801',
              code: 'HT-801',
              kind: 'REFUND',
              agencyId: '101',
              originDocumentId: '202',
              receiptType: null,
              status: 'DRAFT',
              reservedAmount: '100000',
              refundedAmount: '0',
              latestAttemptId: '55',
              latestAttemptState: 'UNKNOWN',
              currentRevision: {
                id: '9801',
                businessDate: '2026-10-07',
                totalAmount: '100000',
                paymentMethod: 'ONLINE',
                agencySnapshot: { name: 'Đại lý Minh Phát' },
                note: null,
                reason: 'Hoàn tiền dư sau trả hàng',
              },
            },
            status: 200,
            etag: '"r1"',
          }
        : list(path, options),
    )
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          <RefundsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết HT-801' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Đang giữ')).toBeDefined()
    expect(within(dialog).getAllByText('100.000 ₫').length).toBe(2)
    expect(within(dialog).getByText('0 ₫')).toBeDefined()
    expect(
      within(dialog).getByText('Chưa rõ').getAttribute('data-status'),
    ).toBe('UNKNOWN')
    expect(within(dialog).getByText('Hoàn tiền dư sau trả hàng')).toBeDefined()
    expect(within(dialog).queryByText(/PENDING\/UNKNOWN/)).toBeNull()
    expect(
      within(dialog).getByRole('button', { name: 'Đối soát lần thử hiện tại' }),
    ).toBeDefined()
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

    const origin = screen.getByRole('combobox', {
      name: /Phiếu thu nguồn \(đã ghi sổ\)/,
    })
    expect(screen.queryByLabelText(/ID phiếu thu/i)).toBeNull()
    fireEvent.focus(origin)
    await waitFor(() =>
      expect(apiModule.apiFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/payment-receipts\?status=POSTED&limit=20/),
        expect.anything(),
      ),
    )
    const method = screen.getByLabelText('Phương thức', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(method.options).map((o) => [o.value, o.text])).toEqual([
      ['CASH', 'Tiền mặt'],
      ['BANK_TRANSFER', 'Chuyển khoản'],
      ['ONLINE', 'Trực tuyến (VNPAY)'],
    ])

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
