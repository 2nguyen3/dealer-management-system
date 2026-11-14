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
import { OnlinePaymentsPage } from '../features/online_payments/OnlinePaymentsPage'
import * as apiModule from '../lib/api'
import * as cacheModule from '../lib/cache'
import { formatDateTime } from '../lib/formatters'
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

  const renderPage = (query = '', auth = mockAuthContext) =>
    render(
      <MemoryRouter initialEntries={[`/online-payments${query}`]}>
        <AuthContext.Provider value={auth}>
          <OnlinePaymentsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

  // AgencyResponse-shaped rows: debt is signed, maxDebt is the type limit.
  const agencies: Record<string, unknown>[] = [
    {
      id: '101',
      code: 'DL-101',
      name: 'Đại lý Minh Phát',
      status: 'ACTIVE',
      debt: '0',
      maxDebt: '5000000',
    },
    {
      id: '102',
      code: 'DL-102',
      name: 'Đại lý Toàn Thắng',
      status: 'ACTIVE',
      debt: '1250000',
      maxDebt: '5000000',
    },
  ]
  let agency102: () => unknown = () => agencies[1]

  const agencyResponse = (path: string) => {
    if (path.startsWith('/agencies?'))
      return {
        data: {
          items: agencies,
          pagination: { limit: 20, nextCursor: null, hasMore: false },
        },
        status: 200,
        etag: null,
      }
    if (path === '/agencies/102')
      return { data: agency102(), status: 200, etag: null }
    return null
  }

  const pickAgency = async (dialog: HTMLElement) => {
    const agency = within(dialog).getByRole('combobox', {
      name: /Đại lý thanh toán/,
    })
    fireEvent.focus(agency)
    fireEvent.click(
      await within(dialog).findByText('DL-102 — Đại lý Toàn Thắng'),
    )
  }

  const debtPanel = (dialog: HTMLElement) =>
    within(dialog).findByLabelText('Công nợ đại lý')

  const detailValue = (scope: HTMLElement, label: string) =>
    within(scope).getByText(label).nextElementSibling?.textContent

  const fillCreate = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Tạo thanh toán mới' }))
    const dialog = screen.getByRole('dialog')
    await pickAgency(dialog)
    await debtPanel(dialog)
    fireEvent.change(screen.getByLabelText(/Số tiền thanh toán/), {
      target: { value: '300000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await within(screen.getByRole('dialog')).findByText('Ghi nhận khi')
  }

  const reviseAmount = async (value: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    fireEvent.change(await screen.findByLabelText(/Số tiền thanh toán/), {
      target: { value },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await within(screen.getByRole('dialog')).findByText('Ghi nhận khi')
  }

  const mockServer = (
    current: () => Record<string, unknown> = () => samplePayments[1]!,
    create?: (
      options: apiModule.RequestOptions,
    ) => Promise<apiModule.ApiResponse<unknown>>,
  ) =>
    vi
      .spyOn(apiModule, 'apiFetch')
      .mockImplementation(async (path, options = {}) => {
        const agency = agencyResponse(path)
        if (agency) return agency
        if (path === '/online-payments' && options.method === 'POST' && create)
          return create(options)
        if (path === '/online-payments/1002')
          return { data: current(), status: 200, etag: null }
        if (
          path === '/online-payments/1002/reconcile' &&
          options.method === 'POST'
        )
          return { data: current(), status: 200, etag: null }
        if (
          path.startsWith('/online-payments?') ||
          path === '/online-payments/1002/events?limit=25'
        )
          return {
            data: {
              items: path.includes('/events?') ? [] : [current()],
              pagination: { limit: 25, nextCursor: null, hasMore: false },
            },
            status: 200,
            etag: null,
          }
        throw new Error(`Unexpected request: ${path}`)
      })

  beforeEach(() => {
    vi.restoreAllMocks()
    agency102 = () => agencies[1]
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path: string) => {
      const agency = agencyResponse(path)
      if (agency) return agency
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
      expect(screen.getAllByText('Thành công').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Chờ xử lý').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('SUCCESS')).toBeNull()
    const row = screen.getByText('REF-2026-001').closest('tr')!
    expect(within(row).getByText('500.000 ₫').className).toContain(
      'cell-number',
    )
    expect(
      within(row).getByText(formatDateTime('2026-10-10T10:05:00Z')),
    ).toBeDefined()
    expect(
      within(row)
        .getByRole('button', { name: 'Chi tiết REF-2026-001' })
        .textContent?.trim(),
    ).toBe('Chi tiết')
    const status = screen.getByLabelText('Trạng thái', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(status.options).map((o) => [o.value, o.text])).toEqual([
      ['', 'Tất cả'],
      ['PENDING', 'Chờ xử lý'],
      ['SUCCESS', 'Thành công'],
      ['FAILED', 'Thất bại'],
      ['EXPIRED', 'Hết hạn'],
    ])
  })

  it('filters by agency picker using the exact agency id', async () => {
    const fetchSpy = vi.spyOn(apiModule, 'apiFetch')
    renderPage()
    await screen.findByText('REF-2026-001')
    expect(screen.queryByLabelText(/ID đại lý/)).toBeNull()
    const filter = screen.getByRole('combobox', { name: /^Đại lý/ })
    fireEvent.focus(filter)
    fireEvent.click(await screen.findByText('DL-101 — Đại lý Minh Phát'))
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([path]) =>
            path.startsWith('/online-payments?') &&
            path.includes('agencyId=101'),
        ),
      ).toBe(true),
    )
  })

  it('shows provider events with formatted time, amount and status', async () => {
    const fetch = mockServer()
    const base = fetch.getMockImplementation()!
    fetch.mockImplementation(async (path, options) =>
      path === '/online-payments/1002/events?limit=25'
        ? {
            data: {
              items: [
                {
                  id: '7',
                  paymentId: '1002',
                  eventKey: 'vnpay:ipn:1',
                  providerStatus: 'FAILED',
                  verifiedData: {
                    merchantReference: 'REF-2026-002',
                    amount: '300000',
                    providerTransactionId: 'TXN-777',
                  },
                  createdAt: '2026-10-11T14:03:00Z',
                },
              ],
              pagination: { limit: 25, nextCursor: null, hasMore: false },
            },
            status: 200,
            etag: null,
          }
        : base(path, options),
    )
    renderPage('?paymentId=1002')
    const dialog = await screen.findByRole('dialog')
    const event = (await within(dialog).findByText('TXN-777')).closest('tr')!
    expect(
      within(event).getByText(formatDateTime('2026-10-11T14:03:00Z')),
    ).toBeDefined()
    expect(within(event).getByText('300.000 ₫').className).toContain(
      'cell-number',
    )
    expect(
      within(event).getByText('Thất bại').getAttribute('data-status'),
    ).toBe('FAILED')
    expect(within(dialog).queryByText(/vnpay:ipn:1/)).toBeNull()
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
      screen.getByRole('combobox', { name: /Đại lý thanh toán/ }),
    ).toBeDefined()
    expect(screen.queryByLabelText(/ID đại lý/)).toBeNull()
    expect(
      screen.getByLabelText(/Số tiền thanh toán \(VND nguyên\)/i, {
        selector: 'input',
      }),
    ).toBeDefined()

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(
        screen.queryByRole('combobox', { name: /Đại lý thanh toán/ }),
      ).toBeNull()
    })
  })

  // Multi-step wizard flows: allow extra time on a loaded CI machine.
  it('retries COMMAND_OUTCOME_UNKNOWN with the same body/key and blocks changed input', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        new apiModule.ApiError(
          409,
          'COMMAND_OUTCOME_UNKNOWN',
          'Outcome unknown',
        ),
      )
      .mockResolvedValue({ data: samplePayments[1], status: 200, etag: null })
    mockServer(undefined, create)
    renderPage()
    await fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    expect(
      await within(screen.getByRole('dialog')).findByText('Outcome unknown'),
    ).toBeDefined()
    await reviseAmount('1')
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    await within(screen.getByRole('dialog')).findByText(/Giữ nguyên nội dung/)
    expect(create).toHaveBeenCalledTimes(1)
    await reviseAmount('300000')
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    expect(
      await screen.findByRole('link', { name: 'Mở trang thanh toán' }),
    ).toBeDefined()
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0])
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      body: { agencyId: '102', provider: 'VNPAY', amount: '300000' },
      idempotencyKey: expect.any(String),
    })
  }, 20_000)

  it('keeps 202 resumable after closing the form, replays the same key, and clears on 200', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...samplePayments[1], checkoutUrl: null },
        status: 202,
        etag: null,
      })
      .mockResolvedValue({ data: samplePayments[1], status: 200, etag: null })
    mockServer(() => ({ ...samplePayments[1]!, checkoutUrl: null }), create)
    renderPage()
    await fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    await screen.findByRole('button', { name: 'Tiếp tục khởi tạo thanh toán' })
    expect(
      within(screen.getByRole('dialog')).getByText('300.000 ₫'),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(create).toHaveBeenCalledTimes(1)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Tiếp tục khởi tạo thanh toán',
      }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Tiếp tục khởi tạo thanh toán' }),
    )
    const link = await screen.findByRole('link', {
      name: 'Mở trang thanh toán',
    })
    expect(link.getAttribute('href')).toBe(samplePayments[1]?.checkoutUrl)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0])
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }))
    await fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    await screen.findByRole('link', { name: 'Mở trang thanh toán' })
    expect(create).toHaveBeenCalledTimes(3)
    expect(create.mock.calls[2]?.[0]?.idempotencyKey).not.toBe(
      create.mock.calls[0]?.[0]?.idempotencyKey,
    )
  }, 20_000)

  it.each(['button', 'focus'])(
    'synchronizes authoritative detail and list on %s refresh',
    async (refresh) => {
      let current = samplePayments[1]!
      const fetch = mockServer(() => current)
      renderPage('?paymentId=1002&status=SUCCESS&receiptDocumentId=999')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('Chờ xử lý')
      expect(detailValue(dialog, 'Phiếu thu')).toBe('Chưa có')
      current = {
        ...current,
        status: 'SUCCESS',
        receiptDocumentId: '502',
        paymentTime: '2026-10-11T14:05:00Z',
        providerTransactionId: 'TXN-002',
      }
      if (refresh === 'button')
        fireEvent.click(
          within(dialog).getByRole('button', { name: 'Kiểm tra trạng thái' }),
        )
      else fireEvent.focus(window)
      await within(dialog).findByText('Thành công')
      await waitFor(() =>
        expect(
          within(screen.getAllByRole('table', { hidden: true })[0]!).getByText(
            'Thành công',
          ),
        ).toBeDefined(),
      )
      expect(within(dialog).getByText(/#502/)).toBeDefined()
      expect(
        within(dialog).queryByRole('link', { name: 'Mở trang thanh toán' }),
      ).toBeNull()
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }),
      )
      const count = fetch.mock.calls.length
      fireEvent.focus(window)
      expect(fetch).toHaveBeenCalledTimes(count)
    },
  )

  it('selects an exact merchantReference from the Return link using server data only', async () => {
    const fetch = mockServer()
    renderPage(
      '?merchantReference=REF-2026-002&status=SUCCESS&vnp_ResponseCode=00',
    )
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Chờ xử lý')
    expect(detailValue(dialog, 'Mã tham chiếu')).toBe('REF-2026-002')
    expect(detailValue(dialog, 'Phiếu thu')).toBe('Chưa có')
    expect(detailValue(dialog, 'Thời điểm thanh toán')).toBe('Chưa xác nhận')
    expect(fetch).toHaveBeenCalledWith(
      '/online-payments/1002',
      expect.any(Object),
    )
    expect(
      fetch.mock.calls.every(
        ([, options]) => !options?.method || options.method === 'GET',
      ),
    ).toBe(true)
  })

  it('does not select a partial merchantReference match', async () => {
    mockServer()
    renderPage('?merchantReference=REF-2026')
    await screen.findByText('Không tìm thấy giao dịch với mã tham chiếu này.')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    '?paymentId=0',
    '?paymentId=9223372036854775808',
    '?paymentId=1002%2Fevents',
    '?merchantReference=',
  ])('rejects invalid direct selectors: %s', async (query) => {
    const fetch = mockServer()
    renderPage(query)
    await screen.findByText(
      query.includes('paymentId')
        ? 'Invalid identifier'
        : 'Mã tham chiếu không hợp lệ.',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      fetch.mock.calls.some(([path]) => /^\/online-payments\//.test(path)),
    ).toBe(false)
  })

  it('keeps failed status reads actionable without trusting Return success', async () => {
    const fetch = mockServer()
    fetch.mockImplementation(async (path) => {
      if (path === '/online-payments/1002')
        throw new apiModule.ApiError(503, 'HTTP_503', 'Status unavailable')
      return {
        status: 200,
        data: {
          items: [],
          pagination: { limit: 25, nextCursor: null, hasMore: false },
        },
        etag: null,
      }
    })
    renderPage('?paymentId=1002&status=SUCCESS')
    await screen.findByText('Status unavailable')
    expect(
      screen.queryByText('Thành công', { ignore: 'option, script, style' }),
    ).toBeNull()

    expect(
      screen.queryByRole('link', { name: 'Mở trang thanh toán' }),
    ).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    'http://sandbox.vnpay.vn/pay',
    'https://user:secret@sandbox.vnpay.vn/pay',
    'javascript:alert(1)',
    'not-a-url',
  ])('does not expose an unsafe checkout URL: %s', async (checkoutUrl) => {
    mockServer(() => ({ ...samplePayments[1]!, checkoutUrl }))
    renderPage('?paymentId=1002')
    await within(await screen.findByRole('dialog')).findByText('Chờ xử lý')
    expect(
      screen.queryByRole('link', { name: 'Mở trang thanh toán' }),
    ).toBeNull()
  })

  it('allows read-only direct selection without requesting protected events or offering writes', async () => {
    const fetch = mockServer()
    renderPage('?paymentId=1002', {
      ...mockAuthContext,
      hasPermission: (permission) => permission === 'debt.read',
    })
    await within(await screen.findByRole('dialog')).findByText('Chờ xử lý')
    expect(fetch.mock.calls.some(([path]) => path.includes('/events'))).toBe(
      false,
    )
    expect(
      screen.queryByRole('button', { name: 'Tạo thanh toán mới' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Đối soát giao dịch hiện tại' }),
    ).toBeNull()
  })

  it('requires an agency and a whole amount before the confirmation step', async () => {
    const create = vi.fn()
    mockServer(undefined, create)
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo thanh toán mới' }),
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    // Without an agency the form never reaches the confirmation step.
    expect(
      within(dialog).queryByRole('button', { name: 'Khởi tạo thanh toán' }),
    ).toBeNull()
    await pickAgency(dialog)
    await debtPanel(dialog)
    fireEvent.change(within(dialog).getByLabelText(/Số tiền thanh toán/), {
      target: { value: '0' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    expect(
      await within(dialog).findByText(/Số tiền phải là số nguyên VND dương/),
    ).toBeDefined()
    expect(
      within(dialog).queryByRole('button', { name: 'Khởi tạo thanh toán' }),
    ).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('shows the current debt and blocks an amount above it', async () => {
    const create = vi.fn()
    mockServer(undefined, create)
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo thanh toán mới' }),
    )
    const dialog = screen.getByRole('dialog')
    await pickAgency(dialog)
    const panel = await debtPanel(dialog)
    expect(within(panel).getByText('1.250.000 ₫')).toBeDefined()
    expect(within(panel).getByText('5.000.000 ₫')).toBeDefined()
    const amount = within(dialog).getByLabelText(/Số tiền thanh toán/)
    fireEvent.change(amount, { target: { value: '1250001' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    expect(
      await within(dialog).findByText(
        'Số tiền vượt công nợ hiện tại (1.250.000 ₫).',
      ),
    ).toBeDefined()
    expect(
      within(dialog).queryByRole('button', { name: 'Khởi tạo thanh toán' }),
    ).toBeNull()
    // Boundary: exactly the current debt, filled by the shortcut.
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Thu toàn bộ nợ' }),
    )
    expect((amount as HTMLInputElement).value).toBe('1250000')
    expect(within(panel).getByText('0 ₫')).toBeDefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    expect(
      await within(dialog).findByRole('button', {
        name: 'Khởi tạo thanh toán',
      }),
    ).toBeDefined()
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ['0', 'Đại lý hiện không còn nợ để thanh toán.'],
    ['-200000', 'Đại lý hiện không còn nợ để thanh toán.'],
  ])('blocks a payment when the agency debt is %s', async (debt, expected) => {
    agency102 = () => ({ ...agencies[1], debt })
    const create = vi.fn()
    mockServer(undefined, create)
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo thanh toán mới' }),
    )
    const dialog = screen.getByRole('dialog')
    await pickAgency(dialog)
    await debtPanel(dialog)
    expect(
      within(dialog).queryByRole('button', { name: 'Thu toàn bộ nợ' }),
    ).toBeNull()
    fireEvent.change(within(dialog).getByLabelText(/Số tiền thanh toán/), {
      target: { value: '1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    expect(await within(dialog).findByText(expected)).toBeDefined()
    expect(create).not.toHaveBeenCalled()
  })

  it('blocks the review when the agency balance cannot be read', async () => {
    agency102 = () => ({ ...agencies[1], debt: 'abc' })
    const create = vi.fn()
    mockServer(undefined, create)
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạo thanh toán mới' }),
    )
    const dialog = screen.getByRole('dialog')
    await pickAgency(dialog)
    expect(
      await within(dialog).findByText('Thông tin công nợ đại lý không hợp lệ.'),
    ).toBeDefined()
    expect(within(dialog).queryByLabelText('Công nợ đại lý')).toBeNull()
    fireEvent.change(within(dialog).getByLabelText(/Số tiền thanh toán/), {
      target: { value: '1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    expect(
      await within(dialog).findByText(
        'Chưa đọc được công nợ hiện tại của đại lý.',
      ),
    ).toBeDefined()
    expect(create).not.toHaveBeenCalled()
  })

  it('reconciles only a PENDING payment and invalidates document caches', async () => {
    const invalidate = vi.spyOn(cacheModule, 'invalidateCache')
    const fetch = mockServer(() => samplePayments[1]!)
    renderPage('?paymentId=1002')
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Chờ xử lý')
    invalidate.mockClear()
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Đối soát giao dịch hiện tại',
      }),
    )
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([path, options]) =>
            path === '/online-payments/1002/reconcile' &&
            options?.method === 'POST',
        ),
      ).toBe(true),
    )
    await waitFor(() =>
      expect(invalidate.mock.calls.map(([prefix]) => prefix)).toEqual(
        expect.arrayContaining([
          '/online-payments',
          '/payment-receipts',
          '/documents',
          '/agencies',
          '/dashboard',
          '/reports',
        ]),
      ),
    )
    expect(
      invalidate.mock.calls.some(([prefix]) => prefix === '/receivables'),
    ).toBe(false)
  })

  it.each(['SUCCESS', 'FAILED', 'EXPIRED'])(
    'does not offer reconciliation for a terminal %s payment',
    async (status) => {
      mockServer(() => ({
        ...samplePayments[1]!,
        status,
        ...(status === 'SUCCESS'
          ? {
              receiptDocumentId: '502',
              paymentTime: '2026-10-11T14:05:00Z',
              providerTransactionId: 'TXN-002',
            }
          : {}),
      }))
      renderPage('?paymentId=1002')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByRole('button', {
        name: 'Kiểm tra trạng thái',
      })
      await waitFor(() =>
        expect(
          within(dialog).queryByText('Đang chờ cổng thanh toán xác nhận'),
        ).toBeNull(),
      )
      expect(
        within(dialog).queryByRole('button', {
          name: 'Đối soát giao dịch hiện tại',
        }),
      ).toBeNull()
    },
  )

  it('links the automatic receipt by code when the receipts page is allowed', async () => {
    const success = {
      ...samplePayments[1]!,
      agencyCode: 'DL-102',
      agencyName: 'Đại lý Toàn Thắng',
      status: 'SUCCESS',
      receiptDocumentId: '502',
      receiptCode: 'PT-502',
      paymentTime: '2026-10-11T14:05:00Z',
      providerTransactionId: 'TXN-002',
    }
    mockServer(() => success)
    const permissions = ['payments.online', 'cash.receipt.post']
    renderPage('?paymentId=1002', {
      ...mockAuthContext,
      allowedFunctions: permissions as AuthContextValue['allowedFunctions'],
      hasPermission: (perm) =>
        Array.isArray(perm)
          ? perm.some((p) => permissions.includes(p))
          : permissions.includes(perm),
    })
    const dialog = await screen.findByRole('dialog')
    const link = await within(dialog).findByRole('link', { name: 'PT-502' })
    expect(link.getAttribute('href')).toBe('/payment-receipts?document=502')
    expect(detailValue(dialog, 'Đại lý')).toBe('DL-102 · Đại lý Toàn Thắng')
  })

  it('shows the receipt code as text when the receipts page is not allowed, falling back to the id', async () => {
    const success = {
      ...samplePayments[1]!,
      status: 'SUCCESS',
      receiptDocumentId: '502',
      receiptCode: 'PT-502',
      paymentTime: '2026-10-11T14:05:00Z',
      providerTransactionId: 'TXN-002',
    }
    let current: Record<string, unknown> = success
    mockServer(() => current)
    // Every viewer of this page can open /payment-receipts today, so the
    // not-allowed branch is exercised with a session that has no grants.
    renderPage('?paymentId=1002', {
      ...mockAuthContext,
      allowedFunctions: [],
      hasPermission: () => false,
    })
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('PT-502')
    expect(within(dialog).queryByRole('link', { name: 'PT-502' })).toBeNull()
    expect(detailValue(dialog, 'Đại lý')).toBe('#102')
    current = { ...success, receiptCode: null }
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Kiểm tra trạng thái' }),
    )
    expect(await within(dialog).findByText('#502')).toBeDefined()
  })

  it('confirms a summary, then hands off with tracker, QR and detail link', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ data: samplePayments[1], status: 201, etag: null })
    mockServer(undefined, create)
    renderPage()
    await fillCreate()
    const confirm = screen.getByRole('dialog')
    expect(within(confirm).getByText('300.000 ₫')).toBeDefined()
    expect(within(confirm).getByText('VNPAY')).toBeDefined()
    expect(create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    const link = await screen.findByRole('link', {
      name: 'Mở trang thanh toán',
    })
    const dialog = screen.getByRole('dialog')
    expect(link.getAttribute('href')).toBe(samplePayments[1]!.checkoutUrl)
    const tracker = within(dialog).getByRole('region', {
      name: 'Tiến trình thanh toán',
    })
    const current = tracker.querySelector('[aria-current="step"]')!
    expect(current.textContent).toContain('Đại lý thanh toán trên VNPAY')
    expect(dialog.querySelector('svg title')?.textContent).toBe(
      'Mã QR trang thanh toán VNPAY',
    )
    expect(
      within(dialog).getByRole('button', { name: 'Kiểm tra trạng thái' }),
    ).toBeDefined()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xem chi tiết' }),
    )
    expect(
      await screen.findByRole('dialog', { name: 'Chi tiết giao dịch' }),
    ).toBeDefined()
    expect(create).toHaveBeenCalledTimes(1)
  }, 20_000)

  it('shows a server FAILED status as a stopped branch without a checkout link', async () => {
    mockServer(() => ({ ...samplePayments[1]!, status: 'FAILED' }))
    renderPage('?paymentId=1002&vnp_ResponseCode=00')
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Thanh toán không thành công')
    const tracker = within(dialog).getByRole('region', {
      name: 'Tiến trình thanh toán',
    })
    const failed = tracker.querySelector('[data-state="failed"]')!
    expect(failed.textContent).toContain('Cổng xác nhận (IPN)')
    expect(within(tracker).getByText('Đã dừng')).toBeDefined()
    expect(tracker.querySelector('[aria-current="step"]')).toBeNull()
    expect(
      within(dialog).queryByRole('link', { name: 'Mở trang thanh toán' }),
    ).toBeNull()
  })

  it('summarises the loaded page by status and sorts by creation time', async () => {
    const fetch = mockServer()
    renderPage()
    const summary = await screen.findByRole('region', {
      name: 'Tổng quan giao dịch',
    })
    expect(
      within(summary).getByText(/Trang hiện tại · 1 giao dịch/),
    ).toBeDefined()
    expect(
      fetch.mock.calls.some(([path]) => path.includes('sort=-createdAt')),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo lúc' }))
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([path]) =>
          /^\/online-payments\?.*sort=createdAt/.test(path),
        ),
      ).toBe(true),
    )
  })
})
