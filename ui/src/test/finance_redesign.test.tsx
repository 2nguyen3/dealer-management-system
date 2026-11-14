import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  AuthContext,
  type AuthContextValue,
} from '../features/authentication/useAuth'
import { OnlinePaymentsPage } from '../features/online_payments/OnlinePaymentsPage'
import { DetailList } from '../features/payment_receipts/DetailList'
import {
  ActionBar,
  ConfirmDialog,
  DetailHeader,
  FilterBar,
  FormActions,
  SectionCard,
  TableCard,
  TableSkeleton,
} from '../features/payment_receipts/financeUi'
import type { FlowStep } from '../features/payment_receipts/flow'
import { FlowSteps } from '../features/payment_receipts/FlowSteps'
import { PageSummary } from '../features/payment_receipts/PageSummary'
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

let api: MockInstance<typeof apiModule.apiFetch>

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(cacheModule, 'getCachedData').mockReturnValue(null)
  vi.spyOn(cacheModule, 'cachedApiFetch').mockResolvedValue(pageOf([]))
  api = vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(pageOf([]))
})

describe('Online payment status panel', () => {
  const payment = (status: string) => ({
    id: '1002',
    agencyId: '102',
    agencyCode: 'DL-102',
    agencyName: 'Đại lý Hòa Bình',
    provider: 'VNPAY',
    merchantReference: 'REF-2026-002',
    providerTransactionId: status === 'SUCCESS' ? 'TXN-2' : null,
    receiptDocumentId: status === 'SUCCESS' ? '502' : null,
    receiptCode: status === 'SUCCESS' ? 'PT-502' : null,
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
    expect(within(dialog).getByText('DL-102 · Đại lý Hòa Bình')).toBeDefined()
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

describe('DetailList', () => {
  it('pairs each label with its value in order', () => {
    const { container } = render(
      <DetailList
        entries={[
          ['Mã', 'PT-1'],
          ['Số tiền', <b key="a">5.000 ₫</b>],
        ]}
      />,
    )
    const terms = [...container.querySelectorAll('dt')].map(
      (node) => node.textContent,
    )
    const values = [...container.querySelectorAll('dd')].map(
      (node) => node.textContent,
    )
    expect(terms).toEqual(['Mã', 'Số tiền'])
    expect(values).toEqual(['PT-1', '5.000 ₫'])
  })

  it('renders an empty list without entries', () => {
    const { container } = render(<DetailList entries={[]} className="x" />)
    const list = container.querySelector('dl')!
    expect(list.children.length).toBe(0)
    expect(list.className).toContain('x')
  })
})

describe('PageSummary', () => {
  it('labels page-only data and lists each group with count and amount', () => {
    render(
      <PageSummary
        title="Tổng quan giao dịch"
        noun="giao dịch"
        total={3}
        groups={[
          {
            key: 'PENDING',
            label: 'Đang chờ',
            count: 2,
            amount: 500000,
            color: 'red',
          },
          {
            key: 'SUCCESS',
            label: 'Thành công',
            count: 1,
            amount: 0,
            color: 'green',
          },
        ]}
        kpis={[{ label: 'Đã ghi nhận', value: '1 tr' }]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Tổng quan giao dịch' })
    expect(
      within(region).getByText('Trang hiện tại · 3 giao dịch'),
    ).toBeDefined()
    expect(within(region).getByText('Đã ghi nhận')).toBeDefined()
    expect(within(region).getAllByText('Đang chờ').length).toBeGreaterThan(0)
    expect(within(region).getByText(/^2 · /)).toBeDefined()
    expect(within(region).getByText(/^1 · /)).toBeDefined()
  })

  it('renders with no groups and no KPIs', () => {
    render(
      <PageSummary title="Trống" noun="dòng" total={0} groups={[]} kpis={[]} />,
    )
    const region = screen.getByRole('region', { name: 'Trống' })
    expect(within(region).getByText('Trang hiện tại · 0 dòng')).toBeDefined()
  })
})

describe('FlowSteps', () => {
  const steps = (...states: FlowStep['state'][]): FlowStep[] =>
    states.map((state, index) => ({
      key: String(index),
      label: `Bước ${index + 1}`,
      state,
    }))

  it('marks the current step and reports progress', () => {
    render(
      <FlowSteps
        label="Tiến trình"
        steps={[
          ...steps('done', 'current', 'upcoming').slice(0, 2),
          { key: '2', label: 'Bước 3', state: 'upcoming', hint: 'Chờ cổng' },
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Tiến trình' })
    const current = region.querySelector('[aria-current="step"]')
    expect(current?.textContent).toContain('Bước 2')
    expect(within(region).getByText('Đang diễn ra')).toBeDefined()
    expect(within(region).getByText('Chờ cổng')).toBeDefined()
    expect(
      screen.getByRole('progressbar', { name: 'Tiến trình: 33%' }),
    ).toBeDefined()
  })

  it.each([
    [['done', 'done'], 'Hoàn thành'],
    [['done', 'failed', 'skipped'], 'Đã dừng'],
    [['done', 'expired'], 'Đã quá hạn'],
  ] as const)('shows the outcome of %j', (states, outcome) => {
    render(<FlowSteps label="Tiến trình" steps={steps(...states)} />)
    expect(screen.getByText(outcome)).toBeDefined()
    expect(document.querySelector('[aria-current="step"]')).toBeNull()
  })

  it('renders an empty tracker as active at 0 %', () => {
    render(<FlowSteps label="Rỗng" steps={[]} />)
    expect(screen.getByText('Đang diễn ra')).toBeDefined()
    expect(screen.getByRole('progressbar', { name: 'Rỗng: 0%' })).toBeDefined()
  })
})

describe('financeUi building blocks', () => {
  it('ConfirmDialog confirms or goes back, and respects disabled', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <ConfirmDialog
        isOpen
        title="Ghi sổ PT-1?"
        description="Không thể hoàn tác."
        confirmLabel="Ghi sổ"
        onConfirm={onConfirm}
        onClose={onClose}
      >
        <p>Chi tiết thêm</p>
      </ConfirmDialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Không thể hoàn tác.')).toBeDefined()
    expect(within(dialog).getByText('Chi tiết thêm')).toBeDefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi sổ' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
    expect(onClose).toHaveBeenCalled()
    rerender(
      <ConfirmDialog
        isOpen
        danger
        disabled
        title="Hủy PT-1?"
        description="x"
        confirmLabel="Hủy"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )
    const confirm = screen.getByRole('button', { name: 'Hủy' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('ConfirmDialog renders nothing when closed', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Ẩn"
        description="x"
        confirmLabel="OK"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('DetailHeader shows the amount only when given', () => {
    const { rerender } = render(
      <DetailHeader code="PT-1" amount="5.000 ₫" meta="Đại lý A" />,
    )
    expect(screen.getByText('PT-1')).toBeDefined()
    expect(screen.getByText('Số tiền')).toBeDefined()
    expect(screen.getByText('5.000 ₫')).toBeDefined()
    expect(screen.getByText('Đại lý A')).toBeDefined()
    rerender(<DetailHeader code="PT-2" tone="danger" />)
    expect(screen.queryByText('Số tiền')).toBeNull()
  })

  it('SectionCard, TableCard and the bars render their content', () => {
    render(
      <>
        <SectionCard title="Phản hồi" description="Đã kiểm tra.">
          <p>nội dung</p>
        </SectionCard>
        <TableCard title="Danh sách" actions={<button>Thêm</button>}>
          <p>bảng</p>
        </TableCard>
        <FilterBar>
          <span>lọc</span>
        </FilterBar>
        <ActionBar>
          <span>hành động</span>
        </ActionBar>
        <FormActions>
          <span>nút</span>
        </FormActions>
      </>,
    )
    for (const text of [
      'Phản hồi',
      'Đã kiểm tra.',
      'nội dung',
      'Danh sách',
      'bảng',
      'lọc',
      'hành động',
      'nút',
    ])
      expect(screen.getByText(text)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Thêm' })).toBeDefined()
  })

  it('TableSkeleton announces loading with the given row count', () => {
    const { container } = render(<TableSkeleton rows={2} label="Đang tải" />)
    expect(screen.getByRole('status').textContent).toContain('Đang tải')
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
    render(<TableSkeleton rows={0} />)
    expect(screen.getAllByRole('status').length).toBe(2)
  })
})
