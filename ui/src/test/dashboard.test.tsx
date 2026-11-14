import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import {
  dashboardAdmission,
  sectionGrants,
} from '../features/dashboard/contracts'
import {
  buildMatrix,
  buildReportQuery,
  emptyFilters,
  monthPeriod,
  shiftMonth,
  trendDelta,
} from '../features/dashboard/model'
import { reportPath, vietnamMonth } from '../features/reports/contracts'
import * as api from '../lib/api'
import { formatPercent } from '../lib/chart'
import { formatDateTime, formatVND } from '../lib/formatters'
import {
  HUGE,
  callsTo,
  mockDashboardApi,
  reportResponse,
  snapshotFixture,
} from './dashboardFixtures'

const auth = vi.hoisted(() => ({
  user: { id: '1' } as { id: string } | null,
  allowedFunctions: [] as string[],
}))
vi.mock('../features/authentication/useAuth', () => ({ useAuth: () => auth }))

const FULL = [...dashboardAdmission, 'reports.read', 'agency.read']
const monthText = (value: string) => `${value.slice(5)}/${value.slice(0, 4)}`

function statusLine() {
  const line = screen
    .getAllByRole('status')
    .find((node) => node.textContent?.includes('Cập nhật lúc'))
  if (!line) throw new Error('status line missing')
  return line
}

/** The card (shadcn Card root) whose title is `title`. */
function card(title: string): HTMLElement {
  const heading = screen.getByText(title, {
    selector: '[data-slot=card-title]',
  })
  return heading.closest('[data-slot=card]') as HTMLElement
}

function showTable(title: string) {
  fireEvent.click(within(card(title)).getByLabelText('Bảng số liệu'))
}

function kpi(label: string): HTMLElement {
  const node = screen.getByText(label, { selector: 'p' })
  return node.closest('[data-slot=card]') as HTMLElement
}

describe('dashboard model', () => {
  it('computes month periods across a year boundary', () => {
    expect(monthPeriod('2026-12')).toEqual({
      fromDate: '2026-12-01',
      toDate: '2027-01-01',
    })
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('derives month-over-month deltas and refuses gaps or zero bases', () => {
    const trend = snapshotFixture('2026-10').sales.monthlyTrend
    expect(trendDelta(trend, '2026-10', 'salesAmount')).toBeCloseTo(0.5)
    expect(trendDelta(trend, '2026-10', 'issueCount')).toBeCloseTo(0.5)
    expect(trendDelta(trend, '2026-11', 'salesAmount')).toBeNull()
    expect(
      trendDelta(
        [
          { month: '2026-09', salesAmount: '0', issueCount: 0 },
          { month: '2026-10', salesAmount: '5', issueCount: 1 },
        ],
        '2026-10',
        'salesAmount',
      ),
    ).toBeNull()
  })

  it('sends only server-supported filters per report', () => {
    const filters = {
      ...emptyFilters,
      agencyId: { id: '2', label: 'B' },
      typeId: { id: '3', label: 'T' },
      wardId: { id: '5', label: 'P' },
      productId: { id: '11', label: 'P' },
    }
    const params = (kind: Parameters<typeof buildReportQuery>[0]) =>
      new URL(
        reportPath(buildReportQuery(kind, '2026-10', filters)),
        'http://test',
      ).searchParams
    expect(params('sales').get('typeId')).toBe('3')
    expect(params('sales').get('agencyId')).toBeNull()
    expect(params('debt').get('wardId')).toBe('5')
    expect(params('product-sales').get('agencyId')).toBe('2')
    expect(params('product-sales').get('productId')).toBeNull()
    expect(params('product-sales').get('limit')).toBe('10')
    expect(params('collections').get('typeId')).toBeNull()
    expect(params('collections').get('agencyId')).toBe('2')
    expect(params('collections').get('sort')).toBe('businessDate')
    expect(params('sales').get('sort')).toBe('-salesAmount')
    expect(params('inventory').get('sort')).toBe('closingStock')
    expect(() =>
      reportPath(
        buildReportQuery('debt', '2026-10', {
          ...emptyFilters,
          typeId: { id: '0', label: 'x' },
        }),
      ),
    ).toThrow()
  })

  it('merges sales and debt rows into one agency matrix', () => {
    const sales = reportResponse(
      '/reports/sales?fromDate=2026-10-01&toDate=2026-11-01&limit=100',
    )
    const rows = buildMatrix(sales as never, null)
    expect(rows.map((row) => row.agencyCode)).toEqual(['DL-02', 'DL-01'])
    expect(rows[0]!.values.closingDebt).toBeUndefined()
    expect(rows[0]!.values.numberOfIssues).toBe('6')
    expect(rows[0]!.values.salesAmount).toBe('1200')
    const debt = reportResponse(
      '/reports/debt?fromDate=2026-10-01&toDate=2026-11-01&limit=100',
    )
    const merged = buildMatrix(sales as never, debt as never)
    expect(merged.find((row) => row.agencyId === '1')!.values).toEqual({
      salesAmount: '800',
      numberOfIssues: '3',
      debtIncrease: '500',
      paidAmount: '0',
      closingDebt: '7000',
    })
    expect(buildMatrix(null, null)).toEqual([])
  })

  it('admits exactly the contract grants and maps each section to its readers', () => {
    expect([...dashboardAdmission].sort()).toEqual([
      'agency.read',
      'cash.receipt.post',
      'cash.receipt.prepare',
      'debt.read',
      'sales.read',
      'stock.issue.post',
      'stock.issue.prepare',
      'stock.receipt.post',
      'stock.receipt.prepare',
    ])
    expect(Object.keys(sectionGrants)).toEqual([
      'agencies',
      'sales',
      'collections',
      'debt',
      'drafts',
    ])
    expect(sectionGrants.collections).toEqual([
      'debt.read',
      'cash.receipt.post',
    ])
    expect(dashboardAdmission).not.toContain('inventory.read')
  })
})

describe('executive dashboard — snapshot only', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    auth.user = { id: '1' }
    auth.allowedFunctions = [...dashboardAdmission]
    mockDashboardApi()
  })

  it('reads one snapshot and renders KPIs with exact values and deltas', async () => {
    const { container } = render(<DashboardPage />)
    await screen.findByText(/Cập nhật lúc/)
    expect(api.apiFetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(api.apiFetch).mock.calls[0]![0]).toBe(
      `/dashboard?month=${vietnamMonth()}`,
    )
    const sales = kpi('Doanh số')
    expect(sales.textContent).toContain('(1.500 ₫)')
    expect(sales.textContent).toContain(`+${formatPercent(0.5)}`)
    expect(sales.textContent).toContain('so với tháng trước')
    expect(kpi('Phiếu xuất đã ghi sổ').textContent).toContain('12')
    const collected = kpi('Tiền đã thu')
    expect(collected.textContent).toContain('(700 ₫)')
    expect(collected.textContent).toContain('6 phiếu thu trong tháng')
    const debt = kpi('Tổng công nợ')
    expect(debt.textContent).toContain(`(${formatVND(HUGE)})`)
    expect(debt.textContent).toContain('17 đại lý đang nợ · trả trước 50 ₫')
    expect(screen.queryByText(HUGE)).toBeNull()
    expect(kpi('Đại lý hoạt động').textContent).toContain('24 / 30')
    const drafts = kpi('Phiếu nháp chưa ghi sổ')
    expect(drafts.textContent).toContain('6')
    expect(drafts.textContent).toContain('PN 1 · PX 2 · PT 3')
    for (const removed of [
      'Doanh số thuần',
      'Hàng trả lại',
      'Mặt hàng tồn thấp',
      'Phiếu xuất đang chờ',
      'Đã xác minh, chưa ghi phiếu thu',
      'Công nợ hiện tại',
    ])
      expect(screen.queryByText(removed), removed).toBeNull()
    // No report access: no report-only visuals and no slicer catalogues.
    expect(screen.queryByText('Ma trận đại lý')).toBeNull()
    expect(screen.queryByText('Doanh số theo đại lý')).toBeNull()
    expect(screen.queryByText('Sức khỏe tồn kho')).toBeNull()
    expect(screen.queryByLabelText('Loại đại lý')).toBeNull()
    expect(container.querySelector('.font-mono')).toBeNull()
  })

  it('shows a formatted update time instead of the raw ISO instant', async () => {
    const { container } = render(<DashboardPage />)
    await screen.findByText(/Cập nhật lúc/)
    const asOf = '2026-10-30T07:39:22+00:00'
    expect(screen.queryByText(asOf)).toBeNull()
    const line = statusLine()
    expect(line.textContent).toContain(`Cập nhật lúc ${formatDateTime(asOf)}`)
    expect(line.textContent).toContain(`Tháng ${monthText(vietnamMonth())}`)
    expect(container.querySelector('time')!.getAttribute('dateTime')).toBe(asOf)
  })

  it('offers the last 24 Vietnam business months as a select', () => {
    render(<DashboardPage />)
    const select = screen.getByLabelText(/^Tháng/) as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    const options = Array.from(select.options)
    expect(options.length).toBe(24)
    const current = vietnamMonth()
    expect(select.value).toBe(current)
    expect(options[0]!.textContent).toBe(`Tháng ${monthText(current)}`)
    options.forEach((option, index) => {
      expect(option.value).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
      if (index) {
        const [y, m] = option.value.split('-').map(Number)
        const [py, pm] = options[index - 1]!.value.split('-').map(Number)
        expect(py! * 12 + pm! - (y! * 12 + m!)).toBe(1)
      }
    })
  })

  it('renders the trend table view and fallback top lists from the snapshot', async () => {
    render(<DashboardPage />)
    await screen.findByText(/Cập nhật lúc/)
    showTable('Xu hướng doanh số')
    const rows = Array.from(
      card('Xu hướng doanh số').querySelectorAll('tbody tr'),
    ).map((row) =>
      Array.from(row.querySelectorAll('th, td')).map(
        (cell) => cell.textContent,
      ),
    )
    expect(rows[1]).toEqual([monthText(vietnamMonth()), '1.500 ₫', '12'])
    expect(card('Mặt hàng bán chạy').textContent).toContain('Toàn công ty')
    showTable('Đại lý nợ nhiều nhất')
    const debtCard = card('Đại lý nợ nhiều nhất')
    const debtCell = within(debtCard).getByText('999.999.999.999.999.999 ₫')
    expect(debtCell.className).toContain('cell-number')
    // A prepaid agency (negative debt) is not listed among debtors.
    expect(debtCard.textContent).not.toContain('Đại lý Bình Minh')
    expect(debtCard.textContent).not.toContain('-50 ₫')
  })

  it('renders the collections donut and its exact table from the snapshot', async () => {
    render(<DashboardPage />)
    await screen.findByText(/Cập nhật lúc/)
    const donut = card('Cơ cấu thu tiền')
    expect(donut.textContent).toContain('Tiền mặt')
    expect(donut.textContent).toContain(formatPercent(400 / 700))
    showTable('Cơ cấu thu tiền')
    const rows = Array.from(
      card('Cơ cấu thu tiền').querySelectorAll('tbody tr'),
    ).map((row) =>
      Array.from(row.querySelectorAll('th, td')).map(
        (cell) => cell.textContent,
      ),
    )
    expect(rows).toEqual([
      ['Tiền mặt', '400 ₫'],
      ['Chuyển khoản', '200 ₫'],
      ['Trực tuyến', '100 ₫'],
      ['Tổng thu', '700 ₫'],
    ])
  })

  it('omits the prepaid hint at zero and sums only the drafts the server sent', async () => {
    mockDashboardApi({
      '/dashboard': (path) => {
        const base = snapshotFixture(
          new URL(path, 'http://test').searchParams.get('month')!,
        )
        return {
          ...base,
          debt: { ...base.debt, prepaidAmount: '0' },
          drafts: { stockIssues: 2 },
        }
      },
    })
    render(<DashboardPage />)
    await screen.findByText(/Cập nhật lúc/)
    const debt = kpi('Tổng công nợ')
    expect(debt.textContent).toContain('17 đại lý đang nợ')
    expect(debt.textContent).not.toContain('trả trước')
    const drafts = kpi('Phiếu nháp chưa ghi sổ')
    expect(drafts.textContent).toContain('PX 2')
    expect(drafts.textContent).not.toContain('PN')
    expect(drafts.textContent).not.toContain('PT')
  })

  it('shows an empty collections donut when nothing was collected', async () => {
    mockDashboardApi({
      '/dashboard': (path) => ({
        ...snapshotFixture(
          new URL(path, 'http://test').searchParams.get('month')!,
        ),
        collections: {
          receiptCount: 0,
          totalAmount: '0',
          cashAmount: '0',
          bankTransferAmount: '0',
          onlineAmount: '0',
        },
      }),
    })
    render(<DashboardPage />)
    expect(await screen.findByText('Chưa thu tiền trong tháng')).toBeTruthy()
    expect(kpi('Tiền đã thu').textContent).toContain('0 phiếu thu trong tháng')
  })

  it.each(
    [
      [],
      ['product.manage'],
      ['reports.read'],
      ['documents.cancel', 'documents.correct', 'payments.online'],
      ['inventory.read'],
    ].map((grants) => ({ grants })),
  )('denies admission without source grants $grants', ({ grants }) => {
    auth.allowedFunctions = grants
    render(<DashboardPage />)
    expect(
      screen.getByText(/Bạn không có quyền truy cập bảng điều khiển/),
    ).toBeTruthy()
    expect(screen.queryByLabelText(/^Tháng/)).toBeNull()
    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it.each(dashboardAdmission)(
    'admits the single grant %s without unauthorized sections',
    async (grant) => {
      auth.allowedFunctions = [grant, 'reports.read']
      render(<DashboardPage />)
      await screen.findByText(/Cập nhật lúc/)
      if (grant !== 'sales.read') {
        expect(screen.queryByText('Doanh số', { selector: 'p' })).toBeNull()
        expect(screen.queryByText('Xu hướng doanh số')).toBeNull()
        expect(screen.queryByText('Mặt hàng bán chạy')).toBeNull()
        expect(callsTo('/reports/sales')).toEqual([])
        expect(callsTo('/reports/product-sales')).toEqual([])
      }
      if (grant !== 'debt.read') {
        expect(screen.queryByText('Tổng công nợ')).toBeNull()
        expect(screen.queryByText('Đại lý nợ nhiều nhất')).toBeNull()
        expect(callsTo('/reports/debt')).toEqual([])
        expect(callsTo('/reports/collections')).toEqual([])
      }
      if (!sectionGrants.collections.includes(grant)) {
        expect(screen.queryByText('Tiền đã thu')).toBeNull()
        expect(screen.queryByText('Cơ cấu thu tiền')).toBeNull()
      } else expect(kpi('Tiền đã thu')).toBeTruthy()
      if (!sectionGrants.drafts.includes(grant))
        expect(screen.queryByText('Phiếu nháp chưa ghi sổ')).toBeNull()
      else expect(kpi('Phiếu nháp chưa ghi sổ')).toBeTruthy()
      if (grant !== 'agency.read')
        expect(screen.queryByText('Đại lý hoạt động')).toBeNull()
      // reports.read alone is enough for the inventory report.
      expect(callsTo('/reports/inventory').length).toBe(1)
    },
  )

  it('accepts omitted optional sections without inventing zeroes', async () => {
    mockDashboardApi({
      '/dashboard': (path) => ({
        month: new URL(path, 'http://test').searchParams.get('month'),
        asOf: '2026-10-30T00:00:00Z',
      }),
    })
    render(<DashboardPage />)
    await screen.findByText(/Cập nhật lúc/)
    expect(screen.getByText(/Chưa có dữ liệu cho:/).textContent).toBe(
      'Chưa có dữ liệu cho: Đại lý, Doanh số, Thu tiền, Công nợ, Phiếu nháp.',
    )
    expect(screen.queryByText('Tổng công nợ')).toBeNull()
    expect(screen.queryByText('0 ₫')).toBeNull()
  })

  it('renders explicit errors and recovers without fallback financial values', async () => {
    vi.mocked(api.apiFetch).mockRejectedValueOnce(new Error('HTTP 403'))
    render(<DashboardPage />)
    expect((await screen.findAllByText(/HTTP 403/)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Tổng công nợ')).toBeNull()
    fireEvent.click(screen.getAllByText('Thử lại')[0]!)
    await screen.findByText('Tổng công nợ', { selector: 'p' })
  })

  it('refetches immediately for a new month and aborts the old request', async () => {
    let resolve!: (value: api.ApiResponse<unknown>) => void
    vi.mocked(api.apiFetch).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }) as never,
    )
    const view = render(<DashboardPage />)
    const firstSignal = vi.mocked(api.apiFetch).mock.calls[0]![1]!.signal!
    const select = screen.getByLabelText(/^Tháng/) as HTMLSelectElement
    const current = vietnamMonth()
    const chosen = select.options[2]!.value
    fireEvent.change(select, { target: { value: chosen } })
    await screen.findByText(/Cập nhật lúc/)
    expect(firstSignal.aborted).toBe(true)
    expect(vi.mocked(api.apiFetch).mock.calls[1]![0]).toBe(
      `/dashboard?month=${chosen}`,
    )
    await act(async () => {
      resolve({
        data: snapshotFixture(current),
        status: 200,
        etag: null,
      })
    })
    expect(statusLine().textContent).toContain(`Tháng ${monthText(chosen)}`)
    auth.allowedFunctions = []
    view.rerender(<DashboardPage />)
    expect(screen.queryByText(/Cập nhật lúc/)).toBeNull()
    expect(vi.mocked(api.apiFetch).mock.calls[1]![1]!.signal!.aborted).toBe(
      true,
    )
  })
})

describe(
  'executive dashboard — reports, slicers and cross-filtering',
  { timeout: 20000 },
  () => {
    beforeEach(() => {
      vi.restoreAllMocks()
      auth.user = { id: '1' }
      auth.allowedFunctions = [...FULL]
      mockDashboardApi()
    })

    async function ready() {
      render(<DashboardPage />)
      await screen.findByText(/Cập nhật lúc/)
      await within(card('Ma trận đại lý')).findByText('Đại lý Bình Minh')
    }

    it('reads each permitted report for the selected month', async () => {
      await ready()
      const { fromDate, toDate } = monthPeriod(vietnamMonth())
      for (const kind of [
        'sales',
        'debt',
        'product-sales',
        'collections',
        'inventory',
      ]) {
        const calls = callsTo(`/reports/${kind}?`)
        expect(calls.length).toBe(1)
        expect(calls[0]!.get('fromDate')).toBe(fromDate)
        expect(calls[0]!.get('toDate')).toBe(toDate)
      }
      expect(callsTo('/reports/sales?')[0]!.get('sort')).toBe('-salesAmount')
      expect(callsTo('/reports/collections?')[0]!.get('sort')).toBe(
        'businessDate',
      )
      expect(callsTo('/reports/debt?')[0]!.get('limit')).toBe('100')
      // Matrix: conditional data bars, totals row, numeric cells.
      const matrix = card('Ma trận đại lý')
      expect(matrix.querySelectorAll('tbody tr').length).toBe(2)
      expect(within(matrix).getByText('Tổng cộng')).toBeTruthy()
      expect(within(matrix).getByText('10.000 ₫').className).toContain(
        'cell-number',
      )
      const bars = Array.from(
        matrix.querySelectorAll<HTMLElement>('tbody td > span[aria-hidden]'),
      ).map((bar) => bar.style.width)
      expect(bars).toContain('calc(100% - 8px)')
      showTable('Thu tiền theo hình thức')
      const channels = card('Thu tiền theo hình thức').textContent
      expect(channels).toContain('400 ₫')
      expect(channels).toContain('200 ₫')
      expect(channels).toContain('Trực tuyến')
      expect(card('Sức khỏe tồn kho')).toBeTruthy()
    })

    it('keeps other visuals when one report fails, then retries only that one', async () => {
      let fail = true
      mockDashboardApi({
        '/reports/debt': (path) =>
          fail ? new Error('Máy chủ công nợ lỗi') : reportResponse(path),
      })
      render(<DashboardPage />)
      const debtCard = await screen
        .findAllByText('Máy chủ công nợ lỗi')
        .then(() => card('Đại lý nợ nhiều nhất'))
      expect(debtCard.textContent).toContain(
        'Không tải được đại lý nợ nhiều nhất',
      )
      await within(card('Doanh số theo đại lý')).findByLabelText(
        'Kiểu hiển thị Doanh số theo đại lý',
      )
      expect(card('Doanh số theo đại lý').textContent).not.toContain(
        'Không tải được',
      )
      expect(kpi('Tổng công nợ')).toBeTruthy()
      const salesCalls = callsTo('/reports/sales?').length
      fail = false
      fireEvent.click(within(debtCard).getByText('Thử lại'))
      await waitFor(() =>
        expect(card('Đại lý nợ nhiều nhất').textContent).not.toContain(
          'Không tải được',
        ),
      )
      expect(callsTo('/reports/sales?').length).toBe(salesCalls)
    })

    it('keeps report visuals when the snapshot fails', async () => {
      mockDashboardApi({ '/dashboard': () => new Error('Snapshot lỗi') })
      render(<DashboardPage />)
      await within(card('Ma trận đại lý')).findByText('Đại lý Bình Minh')
      expect(screen.getByText('Không tải được chỉ số tổng quan')).toBeTruthy()
      expect(screen.queryByText('Tổng công nợ', { selector: 'p' })).toBeNull()
    })

    it('applies a type slicer to sales/debt reports and shows a chip', async () => {
      await ready()
      const type = screen.getByLabelText('Loại đại lý') as HTMLSelectElement
      await waitFor(() => expect(type.options.length).toBe(2))
      fireEvent.change(type, { target: { value: '3' } })
      await waitFor(() => expect(callsTo('/reports/sales?').length).toBe(2))
      expect(callsTo('/reports/sales?')[1]!.get('typeId')).toBe('3')
      await waitFor(() => expect(callsTo('/reports/debt?').length).toBe(2))
      expect(callsTo('/reports/debt?')[1]!.get('typeId')).toBe('3')
      expect(callsTo('/reports/product-sales?').length).toBe(1)
      const chips = screen.getByRole('list', { name: 'Bộ lọc đang áp dụng' })
      expect(chips.textContent).toContain('Loại đại lý: LDL-1 — Loại 1')
      expect(card('Mặt hàng bán chạy').textContent).toContain(
        'Không áp dụng: Loại đại lý',
      )

      const ward = screen.getByRole('combobox', { name: 'Phường/xã' })
      expect(ward.getAttribute('placeholder')).toBe('Tất cả phường/xã')
      fireEvent.focus(ward)
      fireEvent.click(
        await screen.findByRole('option', { name: /Phường Sài Gòn/ }),
      )
      await waitFor(() => expect(callsTo('/reports/debt?').length).toBe(3))
      expect(callsTo('/reports/debt?')[2]!.get('wardId')).toBe('5')
      expect(callsTo('/reports/sales?').length).toBe(2)
      expect(
        screen.getByRole('list', { name: 'Bộ lọc đang áp dụng' }).textContent,
      ).toContain('Phường/xã: Phường Sài Gòn')

      fireEvent.click(screen.getByText('Xóa bộ lọc'))
      expect(
        screen.queryByRole('list', { name: 'Bộ lọc đang áp dụng' }),
      ).toBeNull()
      await waitFor(() => expect(callsTo('/reports/debt?').length).toBe(4))
      expect(callsTo('/reports/debt?')[3]!.get('wardId')).toBeNull()
    })

    it('hides the ward slicer without an agency read/manage grant', async () => {
      auth.allowedFunctions = FULL.filter((code) => code !== 'agency.read')
      render(<DashboardPage />)
      await screen.findByText(/Cập nhật lúc/)
      expect(screen.queryByRole('combobox', { name: 'Phường/xã' })).toBeNull()
      expect(callsTo('/wards').length).toBe(0)
    })

    it('cross-filters by agency from the matrix and clears it from the chip', async () => {
      await ready()
      fireEvent.click(
        screen.getByLabelText('Lọc theo đại lý DL-02 — Đại lý Bình Minh'),
      )
      const chips = screen.getByRole('list', { name: 'Bộ lọc đang áp dụng' })
      expect(chips.textContent).toContain('Đại lý: DL-02 — Đại lý Bình Minh')
      await waitFor(() =>
        expect(callsTo('/reports/product-sales?').length).toBe(2),
      )
      expect(callsTo('/reports/product-sales?')[1]!.get('agencyId')).toBe('2')
      await waitFor(() =>
        expect(callsTo('/reports/collections?').length).toBe(2),
      )
      expect(callsTo('/reports/collections?')[1]!.get('agencyId')).toBe('2')
      // Highlight (not a server filter) on the visuals that plot agencies.
      expect(callsTo('/reports/sales?').length).toBe(1)
      const matrix = card('Ma trận đại lý')
      const selected = matrix.querySelector('tbody tr[aria-selected=true]')!
      expect(selected.textContent).toContain('Đại lý Bình Minh')
      expect(matrix.querySelectorAll('tbody tr.opacity-55').length).toBe(1)
      const focus = await screen.findByRole('region', {
        name: 'Đối tượng đang chọn',
      })
      expect(focus.textContent).toContain('Doanh số của đại lý')
      expect(focus.textContent).toContain('1.200 ₫')
      expect(focus.textContent).toContain('3.000 ₫')
      await waitFor(() =>
        expect(focus.textContent).toContain('Đã thu từ đại lý100 ₫'),
      )

      fireEvent.click(screen.getByLabelText('Bỏ lọc Đại lý'))
      expect(
        screen.queryByRole('list', { name: 'Bộ lọc đang áp dụng' }),
      ).toBeNull()
      expect(
        screen.queryByRole('region', { name: 'Đối tượng đang chọn' }),
      ).toBeNull()
      await waitFor(() =>
        expect(callsTo('/reports/product-sales?').length).toBe(3),
      )
      expect(callsTo('/reports/product-sales?')[2]!.get('agencyId')).toBeNull()
    })

    it('cross-filters by agency from a chart table and toggles off on a second click', async () => {
      await ready()
      showTable('Đại lý nợ nhiều nhất')
      const button = within(card('Đại lý nợ nhiều nhất')).getByLabelText(
        'Lọc theo đại lý DL-01 — Đại lý An Phú',
      )
      fireEvent.click(button)
      expect(button.getAttribute('aria-pressed')).toBe('true')
      expect(
        screen.getByRole('list', { name: 'Bộ lọc đang áp dụng' }).textContent,
      ).toContain('Đại lý: DL-01 — Đại lý An Phú')
      fireEvent.click(button)
      expect(
        screen.queryByRole('list', { name: 'Bộ lọc đang áp dụng' }),
      ).toBeNull()
    })

    it('cross-filters by product and loads the product focus', async () => {
      await ready()
      await within(card('Mặt hàng bán chạy')).findByLabelText(
        'Kiểu hiển thị Mặt hàng bán chạy',
      )
      showTable('Mặt hàng bán chạy')
      fireEvent.click(
        within(card('Mặt hàng bán chạy')).getByLabelText(
          'Lọc theo mặt hàng MH-02 — Dầu ăn',
        ),
      )
      const chips = screen.getByRole('list', { name: 'Bộ lọc đang áp dụng' })
      expect(chips.textContent).toContain('Mặt hàng: MH-02 — Dầu ăn')
      await waitFor(() =>
        expect(
          callsTo('/reports/inventory?').some(
            (params) => params.get('productId') === '12',
          ),
        ).toBe(true),
      )
      const focusSales = callsTo('/reports/product-sales?').find(
        (params) => params.get('productId') === '12',
      )!
      expect(focusSales.get('limit')).toBe('1')
      const focus = await screen.findByRole('region', {
        name: 'Đối tượng đang chọn',
      })
      await waitFor(() => expect(focus.textContent).toContain('7 Chai'))
      expect(focus.textContent).toContain('700 ₫')
    })

    it('shows empty states when the period has no data', async () => {
      mockDashboardApi({
        '/dashboard': (path) => {
          const month = new URL(path, 'http://test').searchParams.get('month')!
          const base = snapshotFixture(month)
          return {
            ...base,
            sales: { ...base.sales, monthlyTrend: [], topProducts: [] },
            debt: { ...base.debt, topAgencies: [] },
          }
        },
        '/reports/': (path) => reportResponse(path, true),
      })
      render(<DashboardPage />)
      expect(await screen.findByText('Chưa có dữ liệu xu hướng')).toBeTruthy()
      expect(
        await screen.findByText('Không có mặt hàng bán trong kỳ'),
      ).toBeTruthy()
      expect(
        await screen.findByText('Không có đại lý nào đang nợ'),
      ).toBeTruthy()
      expect(await screen.findByText('Chưa có doanh số đại lý')).toBeTruthy()
      expect(await screen.findByText('Không có đại lý phù hợp')).toBeTruthy()
      expect(within(card('Ma trận đại lý')).queryByRole('table')).toBeNull()
    })
  },
)
