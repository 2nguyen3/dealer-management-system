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
import { AuditLogsPage } from '../features/audit_logs/AuditLogsPage'
import { UpfrontPaymentsPage } from '../features/upfront_payments/UpfrontPaymentsPage'
import * as apiModule from '../lib/api'
import { formatDateTime } from '../lib/formatters'
import type { FunctionCode } from '../lib/types'

const permissions: FunctionCode[] = [
  'cash.upfront.verify',
  'cash.receipt.post',
  'audit.read',
]

const auth: AuthContextValue = {
  user: null,
  allowedFunctions: permissions,
  isAuthenticated: true,
  isLoading: false,
  hasPermission: (perm) =>
    Array.isArray(perm)
      ? perm.some((p) => permissions.includes(p))
      : permissions.includes(perm),
  login: vi.fn(),
  logout: vi.fn(),
  refreshProfile: vi.fn(),
}

const pageOf = (items: unknown[]) => ({
  data: {
    items,
    pagination: { limit: 25, nextCursor: null, hasMore: false },
  },
  status: 200,
  etag: null,
})

const confirmation = {
  id: '31',
  issueDocumentId: '301',
  issueRevisionId: '3010',
  agencyId: '101',
  amount: '1250000',
  method: 'BANK_TRANSFER',
  receivedAt: '2026-10-09T03:30:00Z',
  verifiedBy: '1',
  verifiedAt: '2026-10-09T03:35:00Z',
  evidenceReference: 'UNC-889',
  state: 'VERIFIED',
  receiptDocumentId: null,
}

const auditRow = {
  id: '91',
  actorId: '4',
  actorType: 'USER',
  functionCode: 'cash.receipt.post',
  action: 'UPDATE',
  entityName: 'documents',
  entityKey: '501',
  oldData: { status: 'DRAFT' },
  newData: { status: 'POSTED' },
  requestId: 'req-abc',
  createdAt: '2026-10-09T03:40:00Z',
  updatedAt: '2026-10-09T03:40:00Z',
}

const renderPage = (ui: ReactNode) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  )

let api: MockInstance<typeof apiModule.apiFetch>

beforeEach(() => {
  vi.restoreAllMocks()
  api = vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (path) => {
    if (path.startsWith('/stock-issues?'))
      return pageOf([
        {
          id: '301',
          code: 'PX-301',
          agencyName: 'Đại lý Minh Phát',
          totalAmount: '1250000',
        },
      ])
    if (path === '/upfront-confirmations/31')
      return { data: confirmation, status: 200, etag: '"u1"' }
    if (path.startsWith('/upfront-confirmations')) return pageOf([confirmation])
    if (path === '/audit-logs/91')
      return { data: auditRow, status: 200, etag: null }
    if (path.startsWith('/audit-logs')) return pageOf([auditRow])
    return pageOf([])
  })
})

const readyIssueDetail = (overrides: Record<string, unknown> = {}) => ({
  id: '301',
  code: 'PX-301',
  kind: 'STOCK_ISSUE',
  agencyId: '101',
  status: 'PENDING',
  upfrontConfirmationId: null,
  currentRevision: {
    id: '3010',
    revisionNo: 2,
    state: 'READY',
    totalAmount: '5000000',
    immediatePayment: '1250000',
    agencySnapshot: { name: 'Đại lý Minh Phát' },
  },
  ...overrides,
})

const withIssueDetail = (detail: unknown) => {
  const base = api.getMockImplementation()!
  api.mockImplementation(async (path, options) =>
    path === '/stock-issues/301'
      ? { data: detail, status: 200, etag: '"i1"' }
      : base(path, options),
  )
}

const openVerifyForm = async () => {
  await screen.findByText('1.250.000 ₫')
  fireEvent.click(
    screen.getByRole('button', { name: 'Ghi nhận tiền thực nhận' }),
  )
  return screen.getByRole('dialog')
}

const fillProof = (dialog: HTMLElement) => {
  fireEvent.change(
    within(dialog).getByLabelText(/Thời điểm thực nhận/, {
      selector: 'input',
    }),
    { target: { value: '2026-10-09T10:30' } },
  )
  fireEvent.change(
    within(dialog).getByLabelText(/Tham chiếu bằng chứng/, {
      selector: 'input',
    }),
    { target: { value: 'UNC-889' } },
  )
}

const postedBodies = () =>
  api.mock.calls
    .filter(
      ([path, options]) =>
        path === '/upfront-confirmations' && options?.method === 'POST',
    )
    .map(([, options]) => options?.body)

const pickIssue = async (dialog: HTMLElement) => {
  const picker = within(dialog).getByRole('combobox', {
    name: /Chọn phiếu xuất chờ ghi sổ/,
  })
  fireEvent.focus(picker)
  fireEvent.click(await within(dialog).findByText('PX-301 — Đại lý Minh Phát'))
}

const enterManualRevision = (dialog: HTMLElement, amount = '1250000') => {
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Nhập mã phiên bản thủ công' }),
  )
  fireEvent.change(
    within(dialog).getByLabelText(/Mã phiên bản phiếu xuất/, {
      selector: 'input',
    }),
    { target: { value: '3010' } },
  )
  fireEvent.change(
    within(dialog).getByLabelText(/Số tiền/, { selector: 'input' }),
    { target: { value: amount } },
  )
}

describe('UpfrontPaymentsPage presentation', () => {
  it('shows formatted rows, Vietnamese labels and no raw ID column', async () => {
    renderPage(<UpfrontPaymentsPage />)
    const row = (
      await screen.findByText('Đã xác minh', { ignore: 'option' })
    ).closest('tr')!
    const cells = within(row)
    expect(
      cells.getByText(formatDateTime(confirmation.receivedAt)),
    ).toBeDefined()
    expect(cells.getByText('Chuyển khoản')).toBeDefined()
    expect(cells.getByText('1.250.000 ₫').className).toContain('cell-number')
    expect(cells.getByText('Phiên bản #3010')).toBeDefined()
    expect(screen.queryByRole('columnheader', { name: 'ID' })).toBeNull()
    expect(
      screen.getByRole('columnheader', { name: 'Số tiền' }).className,
    ).toContain('cell-number')
    expect(screen.queryByText('VERIFIED')).toBeNull()

    const state = screen.getByLabelText('Trạng thái', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(state.options).map((o) => [o.value, o.text])).toEqual([
      ['', 'Tất cả'],
      ['VERIFIED', 'Đã xác minh'],
      ['CONSUMED', 'Đã sử dụng'],
      ['RECEIVED_SEPARATELY', 'Đã thu riêng'],
    ])

    fireEvent.click(
      cells.getByRole('button', {
        name: 'Chi tiết khoản thực nhận phiếu xuất #301',
      }),
    )
    const detail = await screen.findByRole('dialog')
    expect(within(detail).getByText('Chi tiết khoản thực nhận')).toBeDefined()
    expect(await within(detail).findByText('UNC-889')).toBeDefined()
    expect(
      within(detail).getByText(formatDateTime(confirmation.verifiedAt)),
    ).toBeDefined()
    expect(within(detail).getByText('1.250.000 ₫')).toBeDefined()
    expect(within(detail).getByText('Đã xác minh')).toBeDefined()
  })

  it('opens the verification form with method options and no raw revision field by default', async () => {
    renderPage(<UpfrontPaymentsPage />)
    const dialog = await openVerifyForm()
    const method = within(dialog).getByLabelText('Phương thức', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(method.options).map((o) => [o.value, o.text])).toEqual([
      ['CASH', 'Tiền mặt'],
      ['BANK_TRANSFER', 'Chuyển khoản'],
    ])
    expect(
      within(dialog).queryByLabelText(/Mã phiên bản phiếu xuất/),
    ).toBeNull()
    expect(
      within(dialog).getByRole('combobox', {
        name: /Chọn phiếu xuất chờ ghi sổ/,
      }),
    ).toBeDefined()
    const received = within(dialog).getByLabelText(/Thời điểm thực nhận/, {
      selector: 'input',
    }) as HTMLInputElement
    expect(received.type).toBe('datetime-local')
  })

  it('filters by a stock issue chosen from the picker, keeping the exact id', async () => {
    renderPage(<UpfrontPaymentsPage />)
    await screen.findByText('1.250.000 ₫')
    expect(screen.queryByLabelText('ID phiếu xuất')).toBeNull()
    const picker = screen.getByRole('combobox', { name: /Phiếu xuất/ })
    fireEvent.focus(picker)
    fireEvent.click(await screen.findByText('PX-301 — Đại lý Minh Phát'))
    expect((picker as HTMLInputElement).value).toBe('PX-301 — Đại lý Minh Phát')
    await waitFor(() =>
      expect(
        api.mock.calls.some(
          ([path]) =>
            path.startsWith('/upfront-confirmations?') &&
            path.includes('issueDocumentId=301'),
        ),
      ).toBe(true),
    )
  })

  it('derives the READY revision and amount from the picked stock issue', async () => {
    withIssueDetail(readyIssueDetail())
    renderPage(<UpfrontPaymentsPage />)
    const dialog = await openVerifyForm()
    await pickIssue(dialog)
    expect(
      api.mock.calls.some(([path]) =>
        path.startsWith('/stock-issues?status=PENDING'),
      ),
    ).toBe(true)
    expect(await within(dialog).findByText(/mã #3010/)).toBeDefined()
    const amount = within(dialog).getByLabelText(/Số tiền/, {
      selector: 'input',
    }) as HTMLInputElement
    expect(amount.value).toBe('1250000')
    fillProof(dialog)
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác minh tiền thực nhận' }),
    )
    await waitFor(() =>
      expect(postedBodies()).toEqual([
        {
          issueRevisionId: '3010',
          amount: '1250000',
          method: 'CASH',
          receivedAt: '2026-10-09T10:30:00+07:00',
          evidenceReference: 'UNC-889',
        },
      ]),
    )
  })

  it.each([
    [
      'not READY',
      {
        status: 'DRAFT',
        currentRevision: {
          ...readyIssueDetail().currentRevision,
          state: 'DRAFT',
        },
      },
      /chưa ở trạng thái Sẵn sàng/,
    ],
    [
      'already confirmed',
      { upfrontConfirmationId: '31' },
      /đã có khoản thực nhận/,
    ],
    [
      'without an upfront amount',
      {
        currentRevision: {
          ...readyIssueDetail().currentRevision,
          immediatePayment: '0',
        },
      },
      /không có khoản trả ngay/,
    ],
  ])(
    'blocks verification when the picked issue is %s',
    async (_, overrides, problem) => {
      withIssueDetail(readyIssueDetail(overrides))
      renderPage(<UpfrontPaymentsPage />)
      const dialog = await openVerifyForm()
      await pickIssue(dialog)
      expect(await within(dialog).findByText(problem)).toBeDefined()
      fireEvent.change(
        within(dialog).getByLabelText(/Số tiền/, { selector: 'input' }),
        { target: { value: '1250000' } },
      )
      fillProof(dialog)
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: 'Xác minh tiền thực nhận',
        }),
      )
      expect(
        await within(dialog).findByText(
          'Vui lòng chọn phiếu xuất đang ở trạng thái Sẵn sàng.',
        ),
      ).toBeDefined()
      expect(postedBodies()).toEqual([])
    },
  )

  it('shows a load failure for the picked issue without sending', async () => {
    const base = api.getMockImplementation()!
    api.mockImplementation(async (path, options) => {
      if (path === '/stock-issues/301')
        throw new apiModule.ApiError(403, 'FORBIDDEN', 'Không có quyền xem')
      return base(path, options)
    })
    renderPage(<UpfrontPaymentsPage />)
    const dialog = await openVerifyForm()
    await pickIssue(dialog)
    expect(await within(dialog).findByText('Không có quyền xem')).toBeDefined()
    expect(postedBodies()).toEqual([])
  })

  it('submits a manually entered revision id unchanged', async () => {
    renderPage(<UpfrontPaymentsPage />)
    const dialog = await openVerifyForm()
    enterManualRevision(dialog)
    fillProof(dialog)
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác minh tiền thực nhận' }),
    )
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/upfront-confirmations',
        expect.objectContaining({
          method: 'POST',
          body: {
            issueRevisionId: '3010',
            amount: '1250000',
            method: 'CASH',
            receivedAt: '2026-10-09T10:30:00+07:00',
            evidenceReference: 'UNC-889',
          },
        }),
      ),
    )
  })

  it('rejects an incomplete received time without sending', async () => {
    renderPage(<UpfrontPaymentsPage />)
    const dialog = await openVerifyForm()
    enterManualRevision(dialog)
    fireEvent.change(
      within(dialog).getByLabelText(/Tham chiếu bằng chứng/, {
        selector: 'input',
      }),
      { target: { value: 'UNC-889' } },
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác minh tiền thực nhận' }),
    )
    const received = within(dialog).getByLabelText(/Thời điểm thực nhận/, {
      selector: 'input',
    }) as HTMLInputElement
    expect(received.validity.valueMissing).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(postedBodies()).toEqual([])
  })

  it('confirms a separate receipt with reason and the detail ETag', async () => {
    const base = api.getMockImplementation()!
    api.mockImplementation(async (path, options) =>
      path === '/upfront-confirmations/31/receive-separately'
        ? { data: {}, status: 200, etag: null }
        : base(path, options),
    )
    renderPage(<UpfrontPaymentsPage />)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Chi tiết khoản thực nhận phiếu xuất #301',
      }),
    )
    const detail = await screen.findByRole('dialog')
    await within(detail).findByText('UNC-889')
    fireEvent.click(
      within(detail).getByRole('button', { name: 'Ghi nhận tiền riêng' }),
    )
    const confirm = (await screen.findAllByRole('dialog')).find((dialog) =>
      within(dialog).queryByLabelText(/Lý do ghi nhận tiền riêng/),
    )!
    const submit = within(confirm).getByRole('button', {
      name: 'Ghi nhận tiền riêng',
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(
      within(confirm).getByLabelText(/Lý do ghi nhận tiền riêng/, {
        selector: 'input',
      }),
      { target: { value: 'Đại lý trả nợ cũ' } },
    )
    fireEvent.click(submit)
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/upfront-confirmations/31/receive-separately',
        expect.objectContaining({
          method: 'POST',
          ifMatch: '"u1"',
          body: { reason: 'Đại lý trả nợ cũ' },
        }),
      ),
    )
  })
})

describe('AuditLogsPage presentation', () => {
  it('shows Vietnamese action/actor labels, formatted time and detail', async () => {
    renderPage(<AuditLogsPage />)
    const row = (await screen.findByText('cash.receipt.post')).closest('tr')!
    const cells = within(row)
    expect(cells.getByText('Cập nhật')).toBeDefined()
    expect(cells.getByText('Người dùng #4')).toBeDefined()
    expect(cells.getByText(formatDateTime(auditRow.createdAt))).toBeDefined()
    expect(screen.queryByText('UPDATE')).toBeNull()
    const action = screen.getByLabelText('Hành động', {
      selector: 'select',
    }) as HTMLSelectElement
    expect(Array.from(action.options).map((o) => [o.value, o.text])).toEqual([
      ['', 'Tất cả'],
      ['INSERT', 'Tạo mới'],
      ['UPDATE', 'Cập nhật'],
      ['DELETE', 'Xóa'],
    ])
    expect(screen.queryByLabelText('Request ID')).toBeNull()

    fireEvent.click(cells.getByRole('button', { name: 'Xem' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('req-abc')).toBeDefined()
    const blocks = dialog.querySelectorAll('pre.finance-json')
    expect(blocks.length).toBe(2)
    expect(blocks[1]?.textContent).toContain('"POSTED"')
  })
})
