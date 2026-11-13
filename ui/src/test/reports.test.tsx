import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportsPage } from '../features/reports/ReportsPage'
import {
  reports,
  vietnamMonth,
  type ReportKind,
} from '../features/reports/contracts'
import { presetPeriod } from '../features/reports/periods'
import {
  displayValue,
  exportHint,
  isNumeric,
  periodLabel,
  sortLabel,
  sortableColumns,
  visibleColumns,
} from '../features/reports/display'
import * as api from '../lib/api'
import { formatVND } from '../lib/formatters'
import * as exports from '../features/reports/export'
import { huge, reportFixture } from './reportFixtures'

const auth = vi.hoisted(() => ({
  user: { id: '1' },
  allowedFunctions: [
    'reports.read',
    'sales.read',
    'debt.read',
    'inventory.read',
  ],
}))
vi.mock('../features/authentication/useAuth', () => ({ useAuth: () => auth }))

const pickerLabels: Record<string, string> = {
  agencyId: 'Đại lý',
  typeId: 'Loại đại lý',
  productId: 'Mặt hàng',
}
let pickerRows: Record<string, unknown>[] = []

const tabNames: Record<ReportKind, string> = {
  sales: 'Doanh số đại lý',
  debt: 'Công nợ',
  inventory: 'Xuất nhập tồn',
  'product-sales': 'Doanh số mặt hàng',
  'cash-and-credit': 'Thu chi & dư có',
}

function apply() {
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
}
/** Radix tabs activate on primary mouse down. */
function openTab(kind: ReportKind) {
  fireEvent.mouseDown(screen.getByRole('tab', { name: tabNames[kind] }))
}
function exportTrigger() {
  return screen.getByRole('button', {
    name: /Xuất báo cáo/,
  }) as HTMLButtonElement
}
async function exportAs(format: 'pdf' | 'xlsx') {
  fireEvent.keyDown(exportTrigger(), { key: 'Enter' })
  fireEvent.click(
    await screen.findByRole('menuitem', {
      name: `Xuất ${format.toUpperCase()}`,
    }),
  )
}
/** Waits for the detailed table to show the fixture source row. */
function sourceRow() {
  return screen.findByRole('cell', { name: 'Đại lý nguồn' })
}
function response(path: string) {
  const url = new URL(path, 'http://test')
  const kind = url.pathname.split('/').pop() as ReportKind
  return {
    data: reportFixture(
      kind,
      url.searchParams.get('fromDate')!,
      url.searchParams.get('toDate')!,
    ),
    status: 200,
    etag: null,
  }
}
/** Non-report reads: picker searches, including the wards catalogue. */
function lookup(path: string) {
  const items = path.startsWith('/wards')
    ? [{ id: 1, code: '26740', name: 'Phường Sài Gòn', kind: 'WARD' }]
    : pickerRows
  return {
    data: {
      items,
      pagination: { limit: 20, hasMore: false, nextCursor: null },
    },
    status: 200,
    etag: null,
  }
}
function route(path: string) {
  return path.startsWith('/reports/') ? response(path) : lookup(path)
}
function reportCalls() {
  return vi
    .mocked(api.apiFetch)
    .mock.calls.filter(([path]) => String(path).startsWith('/reports/'))
}
/** Picks a record through the searchable picker instead of typing an ID. */
async function choose(label: string, id: string) {
  pickerRows = [{ id, code: `PK-${id}`, name: 'Bản ghi chọn' }]
  const input = screen.getByRole('combobox', { name: label })
  fireEvent.focus(input)
  fireEvent.click(await screen.findByText(`PK-${id} — Bản ghi chọn`))
  expect((input as HTMLInputElement).value).toBe(`PK-${id} — Bản ghi chọn`)
}

describe('authoritative reports', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    pickerRows = []
    auth.user = { id: '1' }
    auth.allowedFunctions = [
      'reports.read',
      'sales.read',
      'debt.read',
      'inventory.read',
    ]
    vi.spyOn(api, 'apiFetch').mockImplementation(
      async (path) => route(path) as never,
    )
  })

  it.each(Object.keys(reports) as ReportKind[])(
    'reads only selected %s on explicit apply with KPIs, charts and table',
    async (kind) => {
      render(<ReportsPage />)
      expect(api.apiFetch).not.toHaveBeenCalled()
      if (kind !== 'sales') openTab(kind)
      expect(
        screen
          .getByRole('tab', { name: tabNames[kind] })
          .getAttribute('aria-selected'),
      ).toBe('true')
      const filter = reports[kind].filters[0]!
      await choose(pickerLabels[filter]!, '9223372036854775807')
      expect(reportCalls()).toHaveLength(0)
      apply()
      const region = await screen.findByRole('region', {
        name: reports[kind].label,
      })
      expect(reportCalls()).toHaveLength(1)
      const [path, options] = reportCalls()[0]!
      expect(path).toContain(`/reports/${kind}?`)
      expect(path).toContain(`${filter}=9223372036854775807`)
      expect(path).toContain(
        'sort=' + encodeURIComponent(reports[kind].sorts[0]!),
      )
      expect(path).toContain('limit=25')
      expect(options?.headers).toEqual({ Accept: 'application/json' })
      // Database IDs are request values only; the table shows codes/names.
      expect(screen.queryByText('9223372036854775807')).toBeNull()
      const product = kind === 'inventory' || kind === 'product-sales'
      expect(
        within(region).getByRole('cell', {
          name: product ? 'MH-01' : 'DL-101',
        }),
      ).toBeTruthy()
      expect(screen.queryByRole('columnheader', { name: 'ID' })).toBeNull()
      expect(
        screen.getByText(/^Kỳ báo cáo: \d{2}\/\d{2}\/\d{4} – /),
      ).toBeTruthy()
      const generated = document.querySelector('time')!
      expect(generated.getAttribute('dateTime')).toBe(
        '2026-10-30T00:39:22.123456+00:00',
      )
      expect(generated.textContent).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
      // KPI strip and three chart cards (two measures + composition) with a
      // table view each.
      const kpis = within(region).getByRole('group', { name: 'Chỉ số chính' })
      expect(kpis.children).toHaveLength(4)
      expect(
        within(region).getAllByRole('radio', { name: 'Bảng số liệu' }),
      ).toHaveLength(3)
      const footer = region.querySelector('tfoot')
      if (kind === 'inventory') expect(footer).toBeNull()
      else expect(footer!.textContent).toContain('Tổng toàn bộ kết quả đã lọc')
      if (kind === 'sales') {
        expect(within(kpis).getByText('Số phiếu xuất')).toBeTruthy()
        expect(within(kpis).getByText('999')).toBeTruthy()
        expect(within(footer as HTMLElement).getByText('999')).toBeTruthy()
        const rate = screen.getByText('0,0001 %')
        expect(rate.className).toContain('cell-number')
        expect(
          screen.getByText(`Toàn công ty: ${formatVND(huge + '00')}`),
        ).toBeTruthy()
        expect(screen.getAllByText('-1 ₫').length).toBeGreaterThan(1)
        expect(screen.queryByText(huge)).toBeNull()
        // Compact KPI values keep the exact amount for assistive technology.
        expect(kpis.textContent).toContain(`(${formatVND(huge)})`)
      }
      if (kind === 'debt') {
        expect(within(kpis).getByText('Nợ cuối kỳ')).toBeTruthy()
        expect(screen.getByText('Biến động công nợ trong kỳ')).toBeTruthy()
      }
      if (kind === 'inventory') {
        expect(screen.getByText('0,001').className).toContain('cell-number')
        expect(screen.getByText('-0,001')).toBeTruthy()
        expect(within(kpis).getByText('Hết tồn cuối kỳ')).toBeTruthy()
        // Every closing stock is zero: the ranked chart explains the blank.
        expect(
          screen.getByText('Không có giá trị khác 0 để vẽ biểu đồ.'),
        ).toBeTruthy()
      }
      if (kind === 'product-sales') {
        expect(
          screen.getByText('Mặt hàng bán nhiều nhất (số lượng)'),
        ).toBeTruthy()
        expect(
          screen.getByText('Mặt hàng doanh số thuần cao nhất'),
        ).toBeTruthy()
      }
      if (kind === 'cash-and-credit') {
        expect(within(kpis).getByText('Tiền đã thu')).toBeTruthy()
        expect(screen.getByText('Biến động dư có trong kỳ')).toBeTruthy()
      }
    },
  )

  it('switches chart cards to an exact-value table view', async () => {
    render(<ReportsPage />)
    apply()
    await sourceRow()
    fireEvent.click(screen.getAllByRole('radio', { name: 'Bảng số liệu' })[0]!)
    const header = screen.getByRole('rowheader', {
      name: 'DL-101 — Đại lý nguồn',
    })
    expect(header.closest('tr')!.textContent).toContain('-1 ₫')
  })

  it('re-sorts on the server from a column header and restarts at page one', async () => {
    render(<ReportsPage />)
    apply()
    await sourceRow()
    const header = screen.getByRole('columnheader', { name: 'Doanh số thuần' })
    expect(header.getAttribute('aria-sort')).toBe('none')
    // Identity/rate columns are not in the sort enum and stay plain headers.
    expect(
      within(
        screen.getByRole('columnheader', { name: 'Tỷ lệ doanh số' }),
      ).queryByRole('button'),
    ).toBeNull()
    fireEvent.click(within(header).getByRole('button'))
    await waitFor(() => expect(reportCalls()).toHaveLength(2))
    expect(reportCalls()[1]![0]).toContain('sort=-netSalesAmount')
    expect(reportCalls()[1]![0]).not.toContain('cursor=')
    await sourceRow()
    expect(
      screen
        .getByRole('columnheader', { name: 'Doanh số thuần' })
        .getAttribute('aria-sort'),
    ).toBe('descending')
    // The filter bar follows, so the applied query is not marked dirty.
    expect((screen.getByLabelText('Sắp xếp') as HTMLSelectElement).value).toBe(
      '-netSalesAmount',
    )
    expect(exportTrigger().disabled).toBe(false)
    fireEvent.click(
      within(
        screen.getByRole('columnheader', { name: 'Doanh số thuần' }),
      ).getByRole('button'),
    )
    await waitFor(() => expect(reportCalls()).toHaveLength(3))
    expect(reportCalls()[2]![0]).toContain('sort=netSalesAmount')
    await sourceRow()
    fireEvent.click(
      within(
        screen.getByRole('columnheader', { name: 'Doanh số thuần' }),
      ).getByRole('button'),
    )
    // Third click returns to the report's default contract sort.
    await waitFor(() => expect(reportCalls()).toHaveLength(4))
    expect(reportCalls()[3]![0]).toContain(
      'sort=' + encodeURIComponent(reports.sales.sorts[0]!),
    )
  })

  it('keeps each tab independent and only reads the active report', async () => {
    render(<ReportsPage />)
    apply()
    await sourceRow()
    openTab('debt')
    expect(screen.queryByRole('cell', { name: 'Đại lý nguồn' })).toBeNull()
    expect(screen.getByRole('status').textContent).toContain(
      'Chưa có dữ liệu báo cáo',
    )
    expect(exportTrigger().disabled).toBe(true)
    expect(reportCalls()).toHaveLength(1)
    apply()
    await screen.findByRole('region', { name: reports.debt.label })
    expect(reportCalls()[1]![0]).toContain('/reports/debt?')
    expect(reportCalls()[1]![0]).toContain('sort=agencyId')
    openTab('sales')
    await screen.findByRole('region', { name: reports.sales.label })
    expect(reportCalls()[2]![0]).toContain('/reports/sales?')
  })

  it('applies period presets and resets filters to the current month', async () => {
    const month = vietnamMonth()
    const previous = presetPeriod('lastMonth', month)
    const current = presetPeriod('thisMonth', month)
    render(<ReportsPage />)
    const clear = screen.getByRole('button', { name: 'Xóa bộ lọc' })
    expect((clear as HTMLButtonElement).disabled).toBe(true)
    const [year, mon] = current.fromDate.split('-')
    expect(
      screen.getByRole('button', { name: `Từ ngày: 01/${mon}/${year}` }),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('radio', { name: 'Tháng này' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Tháng trước' }))
    await choose('Đại lý', '5')
    apply()
    await sourceRow()
    const first = reportCalls()[0]![0]
    expect(first).toContain(`fromDate=${previous.fromDate}`)
    expect(first).toContain(`toDate=${previous.toDate}`)
    expect(first).toContain('agencyId=5')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(
      (screen.getByRole('combobox', { name: 'Đại lý' }) as HTMLInputElement)
        .value,
    ).toBe('')
    apply()
    await waitFor(() => expect(reportCalls()).toHaveLength(2))
    const second = reportCalls()[1]![0]
    expect(second).toContain(`fromDate=${current.fromDate}`)
    expect(second).toContain(`toDate=${current.toDate}`)
    expect(second).not.toContain('agencyId=')
  })

  it('filters by agency type and ward through readable choices', async () => {
    render(<ReportsPage />)
    await choose('Loại đại lý', '3')
    apply()
    await sourceRow()
    expect(reportCalls()[0]![0]).toContain('typeId=3')
    openTab('debt')
    const ward = await screen.findByRole('combobox', { name: 'Phường/xã' })
    expect(ward.getAttribute('placeholder')).toBe('Tất cả phường/xã')
    fireEvent.focus(ward)
    fireEvent.change(ward, { target: { value: 'Sài' } })
    fireEvent.click(
      await screen.findByRole('option', { name: /Phường Sài Gòn/ }),
    )
    expect((ward as HTMLInputElement).value).toBe('Phường Sài Gòn')
    const search = vi
      .mocked(api.apiFetch)
      .mock.calls.map(([path]) => String(path))
      .filter((path) => path.startsWith('/wards?'))
      .at(-1)
    expect(search).toContain(`q=${encodeURIComponent('Sài')}`)
    apply()
    await waitFor(() => expect(reportCalls()).toHaveLength(2))
    expect(reportCalls()[1]![0]).toContain('wardId=1')
  })

  it('offers readable sort and page-size choices with unchanged values', async () => {
    render(<ReportsPage />)
    const sort = screen.getByLabelText('Sắp xếp') as HTMLSelectElement
    const labels = Array.from(sort.options).map((o) => o.textContent)
    expect(labels).toEqual([
      'Đại lý: cũ trước',
      'Đại lý: mới thêm trước',
      'Doanh số gộp: thấp đến cao',
      'Doanh số gộp: cao đến thấp',
      'Doanh số thuần: thấp đến cao',
      'Doanh số thuần: cao đến thấp',
    ])
    expect(Array.from(sort.options).map((o) => o.value)).toEqual(
      reports.sales.sorts,
    )
    expect(labels.join(' ')).not.toMatch(/ID|Tăng:|Giảm:/)
    const limit = screen.getByLabelText(
      'Số dòng mỗi trang',
    ) as HTMLSelectElement
    expect(limit.value).toBe('25')
    fireEvent.change(sort, { target: { value: '-netSalesAmount' } })
    fireEvent.change(limit, { target: { value: '100' } })
    apply()
    await sourceRow()
    expect(reportCalls()[0]![0]).toContain('sort=-netSalesAmount')
    expect(reportCalls()[0]![0]).toContain('limit=100')
  })

  it('shows an empty state and explains why export is disabled', () => {
    render(<ReportsPage />)
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Chưa có dữ liệu báo cáo')
    expect(status.textContent).toContain(
      'Chọn bộ lọc và nhấn Áp dụng để tải dữ liệu.',
    )
    const trigger = exportTrigger()
    expect(trigger.disabled).toBe(true)
    expect(trigger.getAttribute('title')).toBe(
      'Xem báo cáo trước để có thể xuất tệp.',
    )
    expect(
      document.getElementById(trigger.getAttribute('aria-describedby')!)!
        .textContent,
    ).toBe('Xem báo cáo trước để có thể xuất tệp.')
  })

  it.each(
    [
      ['sales.read'],
      ['reports.read'],
      [],
      ['product.manage', 'reports.read'],
    ].map((grants) => ({ grants })),
  )('does not request with missing allOf grants $grants', ({ grants }) => {
    auth.allowedFunctions = grants
    render(<ReportsPage />)
    expect(screen.getByText(/Bạn không có quyền xem báo cáo/)).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByRole('button', { name: /Xuất báo cáo/ })).toBeNull()
    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it('uses inventory defaults for an inventory-only reader', async () => {
    auth.allowedFunctions = ['reports.read', 'inventory.read']
    render(<ReportsPage />)
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    apply()
    await screen.findByRole('region', { name: 'Xuất nhập tồn' })
    expect(vi.mocked(api.apiFetch).mock.calls[0]![0]).toContain(
      'sort=productId',
    )
  })

  it('shows loading skeletons until the report arrives', async () => {
    let resolve!: () => void
    vi.mocked(api.apiFetch).mockImplementationOnce(
      (path) =>
        new Promise((done) => {
          resolve = () => done(route(path) as never)
        }) as never,
    )
    render(<ReportsPage />)
    apply()
    expect(screen.getByText('Đang tải báo cáo...')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Áp dụng' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await act(async () => {
      resolve()
    })
    await sourceRow()
    expect(screen.queryByText('Đang tải báo cáo...')).toBeNull()
  })

  it('preserves empty as empty and exposes invalid-response/network errors with retry', async () => {
    vi.mocked(api.apiFetch).mockResolvedValueOnce({
      ...response('/reports/sales?fromDate=2026-10-01&toDate=2026-11-01'),
      data: [],
    })
    render(<ReportsPage />)
    apply()
    await screen.findByText(/Dữ liệu máy chủ không đúng hợp đồng/)
    expect(screen.getByRole('alert').textContent).toContain(
      'Không thể tải báo cáo',
    )
    vi.mocked(api.apiFetch).mockRejectedValueOnce(
      new Error('HTTP 429: thử lại sau'),
    )
    fireEvent.click(screen.getByText('Thử lại'))
    await screen.findByText(/HTTP 429/)
    vi.mocked(api.apiFetch).mockImplementationOnce(async (path) => {
      const result = response(path)
      result.data.items = []
      return result as never
    })
    fireEvent.click(screen.getByText('Thử lại'))
    await screen.findByText('Không có dữ liệu trong kỳ và bộ lọc đã chọn.')
    expect(screen.queryByText('Đại lý nguồn')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Chỉ số chính' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('validates exact ID filters before issuing any report request', async () => {
    render(<ReportsPage />)
    await choose('Đại lý', '9223372036854775808')
    apply()
    await screen.findByText('ID đại lý không hợp lệ.')
    expect(reportCalls()).toHaveLength(0)
  })

  it('uses opaque cursors, resets on apply, and does not refetch while editing filters', async () => {
    vi.mocked(api.apiFetch).mockImplementation(async (path) => {
      const result = route(path)
      if (path.startsWith('/reports/') && !path.includes('cursor='))
        (result.data as { pagination: unknown }).pagination = {
          limit: 25,
          hasMore: true,
          nextCursor: 'opaque+cursor/=',
        }
      return result as never
    })
    render(<ReportsPage />)
    apply()
    await sourceRow()
    fireEvent.click(screen.getByText('Trang tiếp'))
    await waitFor(() => expect(reportCalls()).toHaveLength(2))
    await sourceRow()
    expect(reportCalls()[1]![0]).toContain('cursor=opaque%2Bcursor%2F%3D')
    fireEvent.click(screen.getByText('Trang trước'))
    await sourceRow()
    expect(reportCalls()[2]![0]).not.toContain('cursor=')
    await choose('Đại lý', '2')
    expect(reportCalls()).toHaveLength(3)
    expect(exportTrigger().disabled).toBe(true)
    expect(exportTrigger().getAttribute('title')).toContain(
      'Bộ lọc đã thay đổi',
    )
    apply()
    await sourceRow()
    expect(reportCalls()[3]![0]).toContain('agencyId=2')
    expect(reportCalls()[3]![0]).not.toContain('cursor=')
  })

  it('aborts stale reads on apply/unmount and never paints a late response', async () => {
    let resolve!: (value: api.ApiResponse<unknown>) => void
    vi.mocked(api.apiFetch).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }) as never,
    )
    const view = render(<ReportsPage />)
    apply()
    const first = reportCalls()[0]!
    await choose('Đại lý', '2')
    apply()
    await sourceRow()
    expect(first[1]!.signal!.aborted).toBe(true)
    await act(async () => {
      resolve({ data: [], status: 200, etag: null })
    })
    expect(screen.queryByText(/Dữ liệu máy chủ không đúng hợp đồng/)).toBeNull()
    view.unmount()
    expect(reportCalls()[1]![1]!.signal!.aborted).toBe(true)
  })

  it('clears sensitive results immediately and aborts on identity/grant changes', async () => {
    const view = render(<ReportsPage />)
    apply()
    await sourceRow()
    auth.allowedFunctions = ['reports.read', 'inventory.read']
    view.rerender(<ReportsPage />)
    expect(screen.queryByText('Đại lý nguồn')).toBeNull()
    expect(vi.mocked(api.apiFetch).mock.calls[0]![1]!.signal!.aborted).toBe(
      true,
    )
    expect(api.apiFetch).toHaveBeenCalledTimes(1)
  })

  it.each(['pdf', 'xlsx'] as const)(
    'exports %s once from the menu with applied filters and handles errors',
    async (format) => {
      let finish!: () => void
      const download = vi
        .spyOn(exports, 'downloadReport')
        .mockImplementationOnce(
          () =>
            new Promise<void>((done) => {
              finish = done
            }),
        )
      render(<ReportsPage />)
      await choose('Đại lý', '7')
      apply()
      await sourceRow()
      expect(exportTrigger().getAttribute('title')).toBe(
        'Xuất toàn bộ kết quả đã lọc',
      )
      await exportAs(format)
      expect(download).toHaveBeenCalledTimes(1)
      expect(download.mock.calls[0]![0].filters).toEqual({ agencyId: '7' })
      expect(download.mock.calls[0]![1]).toBe(format)
      // While exporting the menu is locked, preventing a duplicate export.
      expect(exportTrigger().disabled).toBe(true)
      expect(exportTrigger().getAttribute('title')).toContain('Đang xuất')
      expect(reportCalls()).toHaveLength(1)
      await act(async () => {
        finish()
      })
      await screen.findByText('Đã tải tệp báo cáo toàn bộ kết quả đã lọc.')
      download.mockRejectedValueOnce(new Error('HTTP 406'))
      await exportAs(format)
      await screen.findByText('HTTP 406')
      expect(download).toHaveBeenCalledTimes(2)
    },
  )

  it('aborts an in-flight export on permission loss', async () => {
    const download = vi
      .spyOn(exports, 'downloadReport')
      .mockReturnValue(new Promise(() => {}))
    const view = render(<ReportsPage />)
    apply()
    await sourceRow()
    await exportAs('pdf')
    const signal = download.mock.calls[0]![2]
    auth.allowedFunctions = []
    view.rerender(<ReportsPage />)
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('Đại lý nguồn')).toBeNull()
  })
})

describe('report display helpers', () => {
  it('formats exact strings by column kind without numeric coercion', () => {
    expect(displayValue('salesAmount', huge)).toBe(formatVND(huge))
    expect(displayValue('netSalesAmount', '-1500000')).toBe('-1.500.000 ₫')
    expect(displayValue('closingStock', '1234.500')).toBe('1.234,5')
    expect(displayValue('numberOfIssues', 1200)).toBe('1.200')
    expect(displayValue('salesRate', '12.5')).toBe('12,5 %')
    expect(displayValue('agencyCode', 'DL-1')).toBe('DL-1')
    expect(displayValue('agencyName', '')).toBe('—')
    expect(isNumeric('cashReceived')).toBe(true)
    expect(isNumeric('productName')).toBe(false)
  })

  it('hides database ids, labels sorts and periods for people', () => {
    expect(visibleColumns('inventory')).not.toContain('productId')
    expect(visibleColumns('inventory')).not.toContain('unitId')
    expect(visibleColumns('sales')[0]).toBe('agencyCode')
    expect(sortLabel('-closingDebt')).toBe('Nợ cuối kỳ: cao đến thấp')
    expect(sortLabel('productId')).toBe('Mặt hàng: cũ trước')
    expect(periodLabel('2026-10-01', '2026-11-01')).toBe(
      '01/10/2026 – 31/10/2026',
    )
    expect(periodLabel('2026-12-01', '2027-01-01')).toBe(
      '01/12/2026 – 31/12/2026',
    )
  })

  it('offers header sorting only for visible columns in the sort enum', () => {
    expect([...sortableColumns('sales')]).toEqual([
      'salesAmount',
      'netSalesAmount',
    ])
    expect([...sortableColumns('debt')]).toEqual(['closingDebt'])
    expect([...sortableColumns('inventory')]).toEqual(['closingStock'])
    expect([...sortableColumns('product-sales')]).toEqual([
      'salesAmount',
      'soldQuantity',
    ])
    expect([...sortableColumns('cash-and-credit')]).toEqual([
      'cashReceived',
      'closingCredit',
    ])
    for (const kind of Object.keys(reports) as ReportKind[]) {
      expect(sortableColumns(kind).has('agencyId')).toBe(false)
      expect(sortableColumns(kind).has('productId')).toBe(false)
    }
  })

  it('explains each disabled export reason and none when ready', () => {
    expect(exportHint(false, false, false)).toContain('Xem báo cáo trước')
    expect(exportHint(true, true, false)).toContain('Nhấn Áp dụng')
    expect(exportHint(true, false, true)).toContain('Đang xuất')
    expect(exportHint(true, false, false)).toBeNull()
  })
})
