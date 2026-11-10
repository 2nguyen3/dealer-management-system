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

  const fillCreate = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Tạo thanh toán mới' }))
    fireEvent.change(screen.getByLabelText(/ID đại lý thanh toán/), {
      target: { value: '102' },
    })
    fireEvent.change(screen.getByLabelText(/Số tiền thanh toán/), {
      target: { value: '300000' },
    })
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
        if (path === '/online-payments' && options.method === 'POST' && create)
          return create(options)
        if (path === '/online-payments/1002')
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
    fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    expect(
      await within(screen.getByRole('dialog')).findByText('Outcome unknown'),
    ).toBeDefined()
    fireEvent.change(screen.getByLabelText(/Số tiền thanh toán/), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    await within(screen.getByRole('dialog')).findByText(/Giữ nguyên nội dung/)
    expect(create).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText(/Số tiền thanh toán/), {
      target: { value: '300000' },
    })
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
  })

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
    fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    await screen.findByRole('button', { name: 'Tiếp tục khởi tạo checkout' })
    expect(screen.getByLabelText(/Số tiền thanh toán/)).toHaveProperty(
      'value',
      '300000',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(create).toHaveBeenCalledTimes(1)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Tiếp tục khởi tạo checkout' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Tiếp tục khởi tạo checkout' }),
    )
    const link = await screen.findByRole('link', {
      name: 'Mở trang thanh toán',
    })
    expect(link.getAttribute('href')).toBe(samplePayments[1]?.checkoutUrl)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0])
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }))
    fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo thanh toán' }))
    await screen.findByRole('link', { name: 'Mở trang thanh toán' })
    expect(create).toHaveBeenCalledTimes(3)
    expect(create.mock.calls[2]?.[0]?.idempotencyKey).not.toBe(
      create.mock.calls[0]?.[0]?.idempotencyKey,
    )
  })

  it.each(['button', 'focus'])(
    'synchronizes authoritative detail and list on %s refresh',
    async (refresh) => {
      let current = samplePayments[1]!
      const fetch = mockServer(() => current)
      renderPage('?paymentId=1002&status=SUCCESS&receiptDocumentId=999')
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('REF-2026-002: PENDING')
      expect(within(dialog).getByText(/Chưa có/)).toBeDefined()
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
      await within(dialog).findByText('REF-2026-002: SUCCESS')
      await waitFor(() =>
        expect(
          within(screen.getByRole('table', { hidden: true })).getByText(
            'SUCCESS',
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
    await within(dialog).findByText('REF-2026-002: PENDING')
    expect(within(dialog).getByText(/Chưa có/)).toBeDefined()
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

})
