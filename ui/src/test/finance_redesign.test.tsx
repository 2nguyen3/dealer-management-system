import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { AgencyCreditPage } from '../features/agency_credit/AgencyCreditPage'
import { OnlinePaymentsPage } from '../features/online_payments/OnlinePaymentsPage'
import { PaymentReceiptsPage } from '../features/payment_receipts/PaymentReceiptsPage'
import { ReceivablesPage } from '../features/receivables/ReceivablesPage'
import { RefundsPage } from '../features/refunds/RefundsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import type { FunctionCode } from '../lib/types'

const authWith = (permissions: string[]): AuthContextValue => ({
  user: null,
  allowedFunctions: permissions as FunctionCode[],
  isAuthenticated: true,
  isLoading: false,
  hasPermission: (perm) =>
    Array.isArray(perm)
      ? perm.some((p) => permissions.includes(p))
      : permissions.includes(perm),
  login: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
})

const pageOf = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  data: {
    items,
    pagination: { limit: 25, nextCursor: null, hasMore: false },
    ...extra,
  },
  status: 200,
  etag: null,
})

const renderWith = (ui: ReactNode, permissions: string[], path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authWith(permissions)}>
        {ui}
      </AuthContext.Provider>
    </MemoryRouter>,
  )

const receiptRow = {
  id: '501',
  code: 'PT-501',
  agencyId: '101',
  agencyName: 'Đại lý Minh Phát',
  status: 'DRAFT',
  receiptType: 'DEBT_COLLECTION',
  totalAmount: '5000000',
  paymentMethod: 'CASH',
  businessDate: '2026-10-05',
}

const receiptDetail = (status: string) => ({
  id: '501',
  code: 'PT-501',
  kind: 'PAYMENT_RECEIPT',
  agencyId: '101',
  originDocumentId: null,
  receiptType: 'DEBT_COLLECTION',
  status,
  currentRevision: {
    id: '9001',
    businessDate: '2026-10-05',
    totalAmount: '5000000',
    paymentMethod: 'CASH',
    agencySnapshot: { name: 'Đại lý Minh Phát' },
    note: null,
    reason: null,
  },
})

let api: MockInstance<typeof apiModule.apiFetch>

const posts = () =>
  api.mock.calls.filter(([, options]) => options?.method === 'POST')

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
  vi.spyOn(cacheModule, 'cachedApiFetch').mockResolvedValue(pageOf([]))
  api = vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(pageOf([]))
})

describe('FinancialDocuments action bar', () => {
  const serve = (status: string) =>
    api.mockImplementation(async (path, options = {}) => {
      if (options.method === 'POST')
        return { data: {}, status: 200, etag: null }
      if (path === '/payment-receipts/501')
        return { data: receiptDetail(status), status: 200, etag: '"e7"' }
      if (path.startsWith('/payment-receipts?'))
        return pageOf([{ ...receiptRow, status }])
      return pageOf([])
    })

  const openDetail = async () => {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết PT-501' }),
    )
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Phiếu thu tiền')
    return dialog
  }

  it('shows number, status and amount in the detail header', async () => {
    serve('DRAFT')
    renderWith(<PaymentReceiptsPage />, ['cash.receipt.post'])
    const dialog = await openDetail()
    expect(within(dialog).getByText('PT-501')).toBeDefined()
    expect(within(dialog).getByText('5.000.000 ₫')).toBeDefined()
    expect(within(dialog).getByText('Nháp').getAttribute('data-status')).toBe(
      'DRAFT',
    )
    expect(within(dialog).getByText('Ngày nghiệp vụ 05/10/2026')).toBeDefined()
  })

  it('posts only after confirmation, with the detail ETag', async () => {
    serve('DRAFT')
    renderWith(<PaymentReceiptsPage />, ['cash.receipt.post'])
    const dialog = await openDetail()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi sổ' }))
    let confirm = await screen.findByRole('dialog', { name: 'Ghi sổ PT-501' })
    expect(within(confirm).getByText(/5\.000\.000 ₫/)).toBeDefined()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Quay lại' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Ghi sổ PT-501' }),
      ).toBeNull(),
    )
    expect(posts()).toEqual([])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi sổ' }))
    confirm = await screen.findByRole('dialog', { name: 'Ghi sổ PT-501' })
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Xác nhận ghi sổ' }),
    )
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]![0]).toBe('/payment-receipts/501/post')
    expect(posts()[0]![1]).toMatchObject({ ifMatch: '"e7"' })
  })

  it('requires a cancel reason and sends it trimmed', async () => {
    serve('POSTED')
    renderWith(<PaymentReceiptsPage />, [
      'cash.receipt.post',
      'documents.cancel',
    ])
    const dialog = await openDetail()
    expect(within(dialog).queryByRole('button', { name: 'Ghi sổ' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy phiếu' }))
    const confirm = await screen.findByRole('dialog', { name: 'Hủy PT-501' })
    const submit = within(confirm).getByRole('button', {
      name: 'Hủy phiếu',
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(within(confirm).getByLabelText(/Lý do hủy/), {
      target: { value: '  Nhập trùng  ' },
    })
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]![0]).toBe('/payment-receipts/501/cancel')
    expect(posts()[0]![1]).toMatchObject({
      ifMatch: '"e7"',
      body: { reason: 'Nhập trùng' },
    })
  })

  it('hides write actions without permission', async () => {
    serve('DRAFT')
    renderWith(<PaymentReceiptsPage />, ['debt.read'])
    const dialog = await openDetail()
    expect(within(dialog).queryByRole('button', { name: 'Ghi sổ' })).toBeNull()
    expect(
      within(dialog).queryByRole('button', { name: 'Hủy phiếu' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Lập phiếu thu mới' }),
    ).toBeNull()
  })

  it('filters receipts by payment method and shows an empty state', async () => {
    renderWith(<PaymentReceiptsPage />, ['debt.read'])
    expect(await screen.findByText('Không có chứng từ phù hợp.')).toBeDefined()
    const method = screen.getByLabelText('Hình thức', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(method.options).map((o) => o.value)).toEqual([
      '',
      'CASH',
      'BANK_TRANSFER',
      'ONLINE',
    ])
    fireEvent.change(method, { target: { value: 'BANK_TRANSFER' } })
    await waitFor(() =>
      expect(
        api.mock.calls.some(([path]) =>
          path.includes('paymentMethod=BANK_TRANSFER'),
        ),
      ).toBe(true),
    )
  })

  it('confirms a manual refund payout with a Vietnam-time instant', async () => {
    const refund = {
      id: '802',
      code: 'HT-802',
      kind: 'REFUND',
      agencyId: '101',
      originDocumentId: '501',
      receiptType: null,
      status: 'DRAFT',
      reservedAmount: '50000',
      refundedAmount: '0',
      latestAttemptId: null,
      latestAttemptState: null,
      currentRevision: {
        id: '9802',
        businessDate: '2026-10-08',
        totalAmount: '50000',
        paymentMethod: 'CASH',
        agencySnapshot: { name: 'Đại lý Minh Phát' },
        note: null,
        reason: 'Trả lại tiền thừa',
      },
    }
    api.mockImplementation(async (path, options = {}) => {
      if (options.method === 'POST')
        return { data: {}, status: 200, etag: null }
      if (path === '/refunds/802')
        return { data: refund, status: 200, etag: '"r2"' }
      if (path.startsWith('/refunds?'))
        return pageOf([
          {
            id: '802',
            code: 'HT-802',
            agencyId: '101',
            status: 'DRAFT',
            businessDate: '2026-10-08',
            totalAmount: '50000',
            paymentMethod: 'CASH',
          },
        ])
      return pageOf([])
    })
    renderWith(<RefundsPage />, ['cash.refund.post'])
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết HT-802' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('#501')).toBeDefined()
    fireEvent.click(
      await within(dialog).findByRole('button', {
        name: 'Xác nhận đã chi tiền',
      }),
    )
    const confirm = await screen.findByRole('dialog', {
      name: 'Xác nhận đã chi tiền',
    })
    const submit = within(confirm).getByRole('button', {
      name: 'Xác nhận đã chi tiền',
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    const paidAt = within(confirm).getByLabelText(/Thời điểm đã chi/, {
      selector: 'input',
    }) as HTMLInputElement
    expect(paidAt.type).toBe('datetime-local')
    fireEvent.change(paidAt, { target: { value: '2026-10-08T09:15' } })
    fireEvent.change(
      within(confirm).getByLabelText(/Tham chiếu bằng chứng chi tiền/),
      { target: { value: 'PC-12' } },
    )
    fireEvent.click(submit)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]![0]).toBe('/refunds/802/confirm-paid')
    expect(posts()[0]![1]).toMatchObject({
      ifMatch: '"r2"',
      body: { paidAt: '2026-10-08T09:15:00+07:00', evidenceReference: 'PC-12' },
    })
  })
})

describe('Online payment status panel', () => {
  const payment = (status: string) => ({
    id: '1002',
    agencyId: '102',
    provider: 'VNPAY',
    merchantReference: 'REF-2026-002',
    providerTransactionId: status === 'SUCCESS' ? 'TXN-2' : null,
    receiptDocumentId: status === 'SUCCESS' ? '502' : null,
    paymentTime: status === 'SUCCESS' ? '2026-10-11T14:05:00Z' : null,
    amount: '300000',
    status,
    checkoutUrl: 'https://sandbox.vnpay.vn/pay/002',
  })

  it.each([
    ['PENDING', 'Đang chờ cổng thanh toán xác nhận', true],
    ['SUCCESS', 'Đã ghi nhận thanh toán', false],
    ['FAILED', 'Thanh toán không thành công', false],
    ['EXPIRED', 'Liên kết thanh toán đã hết hạn', false],
  ])('renders %s with its own explanation', async (status, title, link) => {
    api.mockImplementation(async (path) =>
      path === '/online-payments/1002'
        ? { data: payment(status), status: 200, etag: null }
        : pageOf([]),
    )
    renderWith(<OnlinePaymentsPage />, ['debt.read'], '/?paymentId=1002')
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(title)).toBeDefined()
    expect(within(dialog).getByText('300.000 ₫')).toBeDefined()
    expect(
      within(dialog).queryByRole('link', { name: 'Mở trang thanh toán' }) !==
        null,
    ).toBe(link)
  })

  it('keeps provider redirect parameters out of the displayed state', async () => {
    api.mockImplementation(async (path) =>
      path === '/online-payments/1002'
        ? { data: payment('PENDING'), status: 200, etag: null }
        : pageOf([]),
    )
    renderWith(
      <OnlinePaymentsPage />,
      ['debt.read'],
      '/?paymentId=1002&vnp_ResponseCode=00&status=SUCCESS',
    )
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Đang chờ cổng thanh toán xác nhận')
    expect(within(dialog).queryByText('Đã ghi nhận thanh toán')).toBeNull()
    expect(within(dialog).queryByText(/VNPAY không có nghĩa/)).toBeTruthy()
  })
})

describe('Receivables balance and statement', () => {
  const balance = {
    agencyId: '101',
    currentDebt: '15000000',
    currentCredit: '2000000',
    reservedCredit: '500000',
    availableCredit: '1500000',
    maxDebt: '50000000',
    remainingCreditLimit: '35000000',
  }
  const entries = [
    {
      id: '61',
      sourceDocumentId: '301',
      sourceDocumentCode: 'PX-301',
      businessDate: '2026-09-15',
      isEffective: true,
      kind: 'CHARGE',
      amountDelta: '8000000',
      balanceAfter: '23000000',
    },
    {
      id: '62',
      sourceDocumentId: '501',
      sourceDocumentCode: 'PT-501',
      businessDate: '2026-10-05',
      isEffective: true,
      kind: 'PAYMENT',
      amountDelta: '-5000000',
      balanceAfter: '18000000',
    },
  ]

  const serve = () =>
    api.mockImplementation(async (path) => {
      if (path.startsWith('/receivables'))
        return pageOf(
          [
            {
              agencyId: '101',
              agencyCode: 'DL-101',
              agencyName: 'Đại lý Minh Phát',
              currentDebt: '15000000',
              maxDebt: '50000000',
              remainingCreditLimit: '35000000',
            },
          ],
          {
            totals: {
              currentDebt: '15000000',
              currentCredit: '2000000',
            },
          },
        )
      if (path === '/agencies/101/balance')
        return { data: balance, status: 200, etag: null }
      if (path.startsWith('/payment-receipts?'))
        return pageOf([
          {
            id: '501',
            code: 'PT-501',
            status: 'POSTED',
            businessDate: '2026-10-05',
            totalAmount: '5000000',
          },
        ])
      if (path.startsWith('/agencies/101/invoice-balances'))
        return pageOf([
          {
            issueDocumentId: '301',
            code: 'PX-301',
            businessDate: '2026-09-15',
            totalAmount: '8000000',
            outstandingAmount: '3000000',
            settlementStatus: 'PARTIAL',
          },
        ])
      if (path.startsWith('/agencies/101/receivable-entries'))
        return pageOf(entries, {
          openingDebt: '15000000',
          closingDebt: '18000000',
        })
      return pageOf([])
    })

  it('shows filter totals as KPI cards and limit usage per agency', async () => {
    serve()
    renderWith(<ReceivablesPage />, ['debt.read'])
    const totals = await screen.findByRole('region', {
      name: 'Tổng theo bộ lọc',
    })
    expect(within(totals).getByText('Dư nợ')).toBeDefined()
    expect(within(totals).getByText('(15.000.000 ₫)')).toBeDefined()
    expect(
      screen.getByRole('progressbar', { name: 'Sử dụng hạn mức DL-101' }),
    ).toBeDefined()
    expect(screen.getByText('30%')).toBeDefined()
  })

  it('shows debt KPIs, last payment, aging and a running-balance chart with table view', async () => {
    serve()
    renderWith(<ReceivablesPage />, ['debt.read'])
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết công nợ DL-101' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Công nợ hiện tại')).toBeDefined()
    expect(within(dialog).getByText('Số dư có khả dụng')).toBeDefined()
    expect(await within(dialog).findByText('05/10/2026 · PT-501')).toBeDefined()
    expect(within(dialog).getByText('30% hạn mức')).toBeDefined()
    const meter = within(dialog).getByRole('meter', {
      name: 'Mức sử dụng hạn mức nợ',
    })
    expect(meter.getAttribute('aria-valuenow')).toBe('30')
    expect(within(dialog).getByText('Cơ cấu dư có')).toBeDefined()
    expect(
      await within(dialog).findByText(/Tuổi nợ \(tính trên 1 hóa đơn/),
    ).toBeDefined()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Mở sổ công nợ' }),
    )
    expect(await within(dialog).findByText('Diễn biến dư nợ')).toBeDefined()
    expect(
      within(dialog).getByRole('columnheader', { name: 'Tăng nợ' }),
    ).toBeDefined()
    const payment = within(dialog).getByText('PT-501').closest('tr')!
    const cells = within(payment).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '05/10/2026',
      'PT-501',
      'Thanh toán',
      '—',
      '5.000.000 ₫',
      '18.000.000 ₫',
      'Hiệu lực',
    ])

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Bảng số liệu' }))
    const table = within(dialog).getByRole('table', {
      name: 'Bảng số liệu diễn biến dư nợ',
    })
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(['15/09/2026PX-30123.000.000 ₫', '05/10/2026PT-50118.000.000 ₫'])
  })

  it('does not request receipts for the last payment without permission', async () => {
    serve()
    const base = api.getMockImplementation()!
    api.mockImplementation(async (path, options) =>
      path.startsWith('/agencies?')
        ? pageOf([{ id: '101', code: 'DL-101', name: 'Đại lý Minh Phát' }])
        : base(path, options),
    )
    renderWith(<AgencyCreditPage />, ['credit.apply'])
    const form = screen
      .getByRole('button', { name: 'Xem dư có' })
      .closest('form') as HTMLElement
    expect(screen.getByText('Chưa chọn đại lý')).toBeDefined()
    expect(form.getAttribute('data-slot')).toBe('filter-bar')
    fireEvent.focus(within(form).getByRole('combobox', { name: /Đại lý/ }))
    fireEvent.click(await within(form).findByText('DL-101 — Đại lý Minh Phát'))
    fireEvent.click(screen.getByRole('button', { name: 'Xem dư có' }))
    expect(
      await screen.findByText('Không có quyền xem phiếu thu'),
    ).toBeDefined()
    expect(
      screen.getByRole('heading', { name: 'DL-101 — Đại lý Minh Phát' }),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Mở sổ dư có' })).toBeNull()
    expect(
      api.mock.calls.some(([path]) => path.startsWith('/payment-receipts')),
    ).toBe(false)
  })
})

describe('Lifecycle trackers and server sorting', () => {
  it('shows the receipt lifecycle at the posting step and a page summary', async () => {
    api.mockImplementation(async (path) => {
      if (path === '/payment-receipts/501')
        return { data: receiptDetail('DRAFT'), status: 200, etag: '"e7"' }
      if (path.startsWith('/payment-receipts?')) return pageOf([receiptRow])
      return pageOf([])
    })
    renderWith(<PaymentReceiptsPage />, ['cash.receipt.post'])
    const summary = await screen.findByRole('region', {
      name: 'Tổng quan chứng từ',
    })
    expect(within(summary).getByText('Nháp chờ xử lý')).toBeDefined()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết PT-501' }),
    )
    const dialog = await screen.findByRole('dialog')
    const tracker = await within(dialog).findByRole('region', {
      name: 'Vòng đời chứng từ',
    })
    expect(
      tracker.querySelector('[aria-current="step"]')?.textContent,
    ).toContain('Ghi sổ')
  })

  it('sends only contract sort values for receipts', async () => {
    renderWith(<PaymentReceiptsPage />, ['debt.read'])
    await screen.findByText('Không có chứng từ phù hợp.')
    expect(
      api.mock.calls.some(([path]) => path.includes('sort=-businessDate')),
    ).toBe(true)
    api.mockResolvedValue(pageOf([receiptRow]))
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Số tiền' }))
    await waitFor(() =>
      expect(
        api.mock.calls.some(([path]) => path.includes('sort=-totalAmount')),
      ).toBe(true),
    )
    const header = screen.getByRole('columnheader', { name: 'Số tiền' })
    expect(header.getAttribute('aria-sort')).toBe('descending')
  })

  it('sorts receivables by remaining limit on the server', async () => {
    api.mockImplementation(async (path) =>
      path.startsWith('/receivables')
        ? pageOf([
            {
              agencyId: '101',
              agencyCode: 'DL-101',
              agencyName: 'Đại lý Minh Phát',
              currentDebt: '15000000',
              maxDebt: '50000000',
              remainingCreditLimit: '35000000',
            },
          ])
        : pageOf([]),
    )
    renderWith(<ReceivablesPage />, ['debt.read'])
    const header = await screen.findByRole('columnheader', { name: 'Dư nợ' })
    expect(header.getAttribute('aria-sort')).toBe('descending')
    expect(
      api.mock.calls.some(([path]) => path.includes('sort=-currentDebt')),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hạn mức còn lại' }))
    await waitFor(() =>
      expect(
        api.mock.calls.some(([path]) =>
          path.includes('sort=-remainingCreditLimit'),
        ),
      ).toBe(true),
    )
    expect(screen.getByText('Mức dùng hạn mức')).toBeDefined()
  })
})
