import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { AgencyCreditPage } from '../features/agency_credit/AgencyCreditPage'
import { PaymentReceiptsPage } from '../features/payment_receipts/PaymentReceiptsPage'
import { ReceivablesPage } from '../features/receivables/ReceivablesPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { Agency, UserResponse } from '../lib/types'

describe('Receivables & Payment Receipts Component Tests', () => {
  const mockUser: UserResponse = {
    id: '1',
    fullName: 'Kế toán công nợ',
    email: 'ketoannoc@agentra.vn',
    groupId: 3,
    groupCode: 'ACCOUNTING',
    groupName: 'Kế toán',
    status: 'ACTIVE',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  }

  const mockAuthContext: AuthContextValue = {
    user: mockUser,
    allowedFunctions: [
      'debt.read',
      'cash.receipt.prepare',
      'cash.receipt.post',
    ],
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm) =>
      Array.isArray(perm)
        ? perm.some((p) =>
            ['debt.read', 'cash.receipt.prepare', 'cash.receipt.post'].includes(
              p,
            ),
          )
        : ['debt.read', 'cash.receipt.prepare', 'cash.receipt.post'].includes(
            perm,
          ),
    login: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }

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
  ]

  const sampleReceivables = [
    {
      agencyId: '101',
      agencyCode: 'DL-101',
      agencyName: 'Đại lý Minh Phát',
      districtName: 'Quận 1',
      currentDebt: '15000000',
      maxDebt: '50000000',
      remainingCreditLimit: '35000000',
      availableCredit: '2000000',
      status: 'ACTIVE' as const,
    },
  ]

  const samplePaymentReceipts = [
    {
      id: '501',
      code: 'PT-501',
      agencyId: '101',
      agencyName: 'Đại lý Minh Phát',
      status: 'POSTED',
      receiptType: 'DEBT_COLLECTION',
      amount: '5000000',
      totalAmount: '5000000',
      paymentMethod: 'BANK_TRANSFER',
      businessDate: '2026-10-05',
      note: 'Thu nợ tiền mặt đợt 1',
      createdAt: '2026-10-05T02:00:00Z',
    },
  ]

  const receiptDetail = {
    id: '501',
    code: 'PT-501',
    kind: 'PAYMENT_RECEIPT',
    agencyId: '101',
    originDocumentId: null,
    receiptType: 'DEBT_COLLECTION',
    status: 'POSTED',
    currentRevision: {
      id: '9001',
      businessDate: '2026-10-05',
      totalAmount: '5000000',
      paymentMethod: 'BANK_TRANSFER',
      agencySnapshot: { name: 'Đại lý Minh Phát' },
      note: 'Thu nợ đợt 1',
      reason: null,
    },
  }

  const balance = {
    agencyId: '101',
    currentDebt: '15000000',
    currentCredit: '2000000',
    reservedCredit: '0',
    availableCredit: '2000000',
    maxDebt: '50000000',
    remainingCreditLimit: '35000000',
    asOf: '2026-10-10T00:00:00Z',
  }

  const pageOf = (items: unknown[], extra: Record<string, unknown> = {}) => ({
    data: {
      items,
      pagination: { limit: 25, nextCursor: null, hasMore: false },
      ...extra,
    },
    status: 200,
    etag: null,
  })

  let apiSpy: MockInstance<typeof apiModule.apiFetch>

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
    vi.spyOn(cacheModule, 'cachedApiFetch').mockImplementation(
      async (path: string) => {
        if (path.startsWith('/agencies')) return pageOf(sampleAgencies)
        if (path.startsWith('/receivables')) return pageOf(sampleReceivables)
        if (path.startsWith('/payment-receipts'))
          return pageOf(samplePaymentReceipts)
        return pageOf([])
      },
    )
    apiSpy = vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(async (path: string, options = {}) => {
        if (path === '/payment-receipts' && options.method === 'POST')
          return { data: { id: '777' }, status: 201, etag: null }
        if (path === '/payment-receipts/501')
          return { data: receiptDetail, status: 200, etag: '"e1"' }
        if (path.startsWith('/receivables')) return pageOf(sampleReceivables)
        if (path.startsWith('/payment-receipts'))
          return pageOf(samplePaymentReceipts)
        if (path === '/agencies/101/balance')
          return { data: balance, status: 200, etag: null }
        if (path.startsWith('/agencies/101/invoice-balances'))
          return pageOf([
            {
              issueDocumentId: '301',
              code: 'PX-301',
              agencyId: '101',
              businessDate: '2026-09-15',
              totalAmount: '8000000',
              outstandingAmount: '3000000',
              settlementStatus: 'PARTIAL',
            },
          ])
        if (path.startsWith('/agencies/101/credit-lots'))
          return pageOf([
            {
              id: '41',
              agencyId: '101',
              sourceDocumentId: '501',
              sourceRevisionId: '9001',
              originReceiptId: '501',
              balance: '2000000',
              reserved: '0',
              available: '2000000',
            },
          ])
        if (path.startsWith('/agencies/101/receivable-entries'))
          return pageOf(
            [
              {
                id: '61',
                sourceDocumentId: '301',
                sourceDocumentCode: 'PX-301',
                sourceRevisionNo: 1,
                businessDate: '2026-09-15',
                isEffective: true,
                kind: 'CHARGE',
                amountDelta: '8000000',
                balanceAfter: '23000000',
              },
            ],
            { openingDebt: '15000000', closingDebt: '23000000' },
          )
        if (path.startsWith('/agencies/101'))
          return { data: sampleAgencies[0], status: 200, etag: null }
        if (path.startsWith('/agencies')) return pageOf(sampleAgencies)
        return pageOf([])
      })
  })

  const renderWithAuth = (ui: ReactNode) =>
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthContext}>
          {ui}
        </AuthContext.Provider>
      </MemoryRouter>,
    )

  const pickAgency = async (scope: HTMLElement, name: RegExp) => {
    const combobox = within(scope).getByRole('combobox', { name })
    fireEvent.focus(combobox)
    fireEvent.click(await within(scope).findByText('DL-101 — Đại lý Minh Phát'))
    return combobox
  }

  it('renders ReceivablesPage with agency debt and credit summary', async () => {
    renderWithAuth(<ReceivablesPage />)

    await waitFor(() => {
      expect(screen.getByText('Đại lý Minh Phát')).toBeDefined()
      expect(screen.getByText('15.000.000 ₫')).toBeDefined()
    })
    expect(screen.getByText('15.000.000 ₫').className).toContain('cell-number')
    expect(screen.getByText('35.000.000 ₫').className).toContain('cell-number')
    expect(
      screen.getByRole('columnheader', { name: 'Dư nợ' }).className,
    ).toContain('cell-number')
  })

  it('opens agency receivable detail with named title, badges and formatted statement', async () => {
    renderWithAuth(<ReceivablesPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết công nợ DL-101' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Chi tiết công nợ DL-101 — Đại lý Minh Phát'),
    ).toBeDefined()
    expect(await within(dialog).findByText('Dư nợ hiện tại')).toBeDefined()
    expect(within(dialog).getByText('50.000.000 ₫')).toBeDefined()
    const partial = await within(dialog).findByText('Tất toán một phần')
    expect(partial.getAttribute('data-status')).toBe('PARTIAL')
    expect(within(dialog).queryByText('PARTIAL')).toBeNull()
    expect(within(dialog).getByText('15/09/2026')).toBeDefined()
    expect(within(dialog).getByText('3.000.000 ₫').className).toContain(
      'cell-number',
    )

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Mở sổ công nợ' }),
    )
    expect(await within(dialog).findByText('Ghi nợ')).toBeDefined()
    expect(within(dialog).getAllByText('8.000.000 ₫').length).toBe(2)
    expect(within(dialog).getAllByText('23.000.000 ₫').length).toBe(2)
    expect(within(dialog).getByText('Phiên bản 1')).toBeDefined()
    expect(within(dialog).queryByText('8000000')).toBeNull()
  })

  it('renders PaymentReceiptsPage with receipt code and amount', async () => {
    renderWithAuth(<PaymentReceiptsPage />)

    await waitFor(() => {
      expect(screen.getByText('PT-501')).toBeDefined()
      expect(screen.getByText('5.000.000 ₫')).toBeDefined()
    })

    const createBtn = screen.getByRole('button', {
      name: /Lập phiếu thu mới/i,
    })
    expect(createBtn).toBeDefined()
  })

  it('shows Vietnamese labels, formatted values and code-labelled actions', async () => {
    renderWithAuth(<PaymentReceiptsPage />)
    const row = (await screen.findByText('PT-501')).closest('tr')!
    const cells = within(row)
    expect(cells.getByText('05/10/2026')).toBeDefined()
    expect(cells.getByText('Chuyển khoản')).toBeDefined()
    expect(cells.getByText('Thu công nợ')).toBeDefined()
    const badge = cells.getByText('Đã ghi sổ')
    expect(badge.getAttribute('data-status')).toBe('POSTED')
    expect(cells.getByText('5.000.000 ₫').className).toContain('cell-number')
    expect(screen.queryByText('POSTED')).toBeNull()
    expect(screen.queryByText('BANK_TRANSFER')).toBeNull()

    const status = screen.getByLabelText('Trạng thái', {
      selector: 'select',
    }) as HTMLSelectElement
    const options = Array.from(status.options)
    expect(options.map((option) => option.value)).toEqual([
      '',
      'DRAFT',
      'PENDING',
      'POSTED',
      'CANCELLED',
    ])
    expect(options.map((option) => option.textContent)).toEqual([
      'Tất cả',
      'Nháp',
      'Chờ xử lý',
      'Đã ghi sổ',
      'Đã hủy',
    ])

    const detail = cells.getByRole('button', { name: 'Chi tiết PT-501' })
    expect(detail.textContent).toBe('Chi tiết')
    fireEvent.click(detail)
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Phiếu thu tiền')).toBeDefined()
    expect(within(dialog).getByText('Đã ghi sổ')).toBeDefined()
    expect(within(dialog).getByText('5.000.000 ₫')).toBeDefined()
    expect(within(dialog).getByText('Chuyển khoản')).toBeDefined()
    expect(within(dialog).getByText('Thu công nợ')).toBeDefined()
    expect(within(dialog).queryByText('POSTED')).toBeNull()
  })

  it('filters by agency picker and creates a draft with the exact agency id', async () => {
    renderWithAuth(<PaymentReceiptsPage />)
    await screen.findByText('PT-501')
    const filterBar = screen
      .getByLabelText('Tìm chứng từ', { selector: 'input' })
      .closest('[data-slot="filter-bar"]') as HTMLElement
    await pickAgency(filterBar, /Đại lý/)
    await waitFor(() =>
      expect(
        apiSpy.mock.calls.some(
          ([path]) =>
            path.startsWith('/payment-receipts?') &&
            path.includes('agencyId=101'),
        ),
      ).toBe(true),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Lập phiếu thu mới' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByLabelText(/ID đại lý/)).toBeNull()
    const methods = within(dialog).getByLabelText('Phương thức', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(methods.options).map((o) => o.textContent)).toEqual([
      'Tiền mặt',
      'Chuyển khoản',
    ])
    await pickAgency(dialog, /Đại lý/)
    fireEvent.change(within(dialog).getByLabelText(/Số tiền/), {
      target: { value: '2500000' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Lưu bản nháp' }),
    )
    await waitFor(() =>
      expect(apiSpy).toHaveBeenCalledWith(
        '/payment-receipts',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            agencyId: '101',
            amount: '2500000',
            paymentMethod: 'CASH',
          }),
        }),
      ),
    )
  })

  it('lets AgencyCreditPage choose an agency by name and shows formatted lots', async () => {
    renderWithAuth(<AgencyCreditPage />)
    expect(screen.queryByLabelText(/ID đại lý/)).toBeNull()
    const form = screen
      .getByRole('button', { name: 'Xem dư có' })
      .closest('form') as HTMLElement
    await pickAgency(form, /Đại lý/)
    fireEvent.click(screen.getByRole('button', { name: 'Xem dư có' }))
    expect(await screen.findByText('Hạn mức nợ')).toBeDefined()
    await waitFor(() =>
      expect(apiSpy).toHaveBeenCalledWith(
        expect.stringContaining('/agencies/101/credit-lots'),
        expect.anything(),
      ),
    )
    const header = screen.getByRole('columnheader', { name: 'Khả dụng' })
    expect(header.className).toContain('cell-number')
    const lotRow = (await screen.findByText('#41')).closest('tr')!
    const amounts = within(lotRow).getAllByText('2.000.000 ₫')
    expect(amounts.length).toBe(2)
    expect(amounts[0]!.className).toContain('cell-number')
  })
})
