import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StockReceiptsPage } from '../features/stock_receipts/StockReceiptsPage'
import { StockIssuesPage } from '../features/stock_issues/StockIssuesPage'
import { StockAdjustmentsPage } from '../features/stock_adjustments/StockAdjustmentsPage'
import { SalesReturnsPage } from '../features/sales_returns/SalesReturnsPage'
import { StockCountsPage } from '../features/stock_counts/StockCountsPage'
import * as api from '../lib/api'
import * as cache from '../lib/cache'
import {
  detail,
  page,
  renderGoods,
  response,
  revision,
  summary,
} from './goodsFixtures'

// DateField is a calendar popover; these workflow tests type ISO dates directly.
vi.mock('../components/blocks/DateField', async () => {
  const React = await import('react')
  return {
    DateField: ({
      label,
      value,
      onChange,
    }: {
      label?: string
      value: string
      onChange: (value: string) => void
    }) =>
      React.createElement('input', {
        'aria-label': label,
        value,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value),
      }),
  }
})

function input(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
/** Opens an EntityPicker combobox and clicks the option with this label. */
async function pick(combobox: HTMLElement, option: string) {
  fireEvent.focus(combobox)
  fireEvent.click(await screen.findByText(option))
}
function lineGroup(index: number) {
  return screen.getByRole('group', { name: `Dòng ${index}` })
}
const products = [
  {
    id: '9223372036854775807',
    code: 'SP-1',
    name: 'Bút bi',
    currentStock: '10',
    unitName: 'Cây',
  },
]
function posts() {
  return vi
    .mocked(api.apiFetch)
    .mock.calls.filter(([, options]) => options?.method === 'POST')
}
function badge(status: string) {
  return document.querySelector(`.badge[data-status="${status}"]`)
}
function statusTabs() {
  const group = screen.getByRole('radiogroup', { name: 'Lọc theo trạng thái' })
  return within(group)
    .getAllByRole('radio')
    .map((item) => [item.textContent, item.getAttribute('aria-checked')])
}
function headers() {
  return screen
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent?.trim())
}
describe('source-aligned goods documents', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'invalidateCache').mockImplementation(() => {})
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary()])),
    )
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(detail()))
  })
  it.each([
    [StockReceiptsPage, 'STOCK_RECEIPT', '/stock-receipts'],
    [StockIssuesPage, 'STOCK_ISSUE', '/stock-issues'],
    [StockAdjustmentsPage, 'STOCK_ADJUSTMENT', '/stock-adjustments'],
    [SalesReturnsPage, 'SALES_RETURN', '/sales-returns'],
  ] as const)(
    'loads one bounded list and demand-loads %s detail, no master prefetch',
    async (Component, kind, path) => {
      const doc = detail(kind)
      vi.mocked(cache.cachedApiFetch).mockResolvedValue(
        response(page([summary(doc)])),
      )
      vi.mocked(api.apiFetch).mockResolvedValue(response(doc))
      renderGoods(<Component />)
      await screen.findByText(doc.code)
      expect(cache.cachedApiFetch).toHaveBeenCalledTimes(1)
      expect(cache.cachedApiFetch).toHaveBeenCalledWith(
        `${path}?limit=25&sort=-businessDate`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
      expect(api.apiFetch).not.toHaveBeenCalled()
      const button = screen.getByRole('button', {
        name: `Chi tiết ${doc.code}`,
      })
      expect(button.textContent).toBe('Chi tiết')
      fireEvent.click(button)
      await screen.findByText('Historical product')
      expect(api.apiFetch).toHaveBeenCalledTimes(1)
      expect(api.apiFetch).toHaveBeenCalledWith(
        `${path}/1`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
      // Exact decimal strings are formatted without Number() precision loss.
      expect(
        screen.getAllByText('900.719.925.474.099.301 ₫').length,
      ).toBeGreaterThan(1)
      expect(screen.getByText('1,001')).toBeDefined()
      expect(screen.queryByText('900719925474099301')).toBeNull()
    },
  )
  it('formats list rows, hides constant columns and labels statuses in Vietnamese', async () => {
    const doc = detail('STOCK_RECEIPT', {
      status: 'POSTED',
      currentRevision: revision({ revisionNo: 2, totalAmount: '119850' }),
    })
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(
      response(page([summary(doc)])),
    )
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    expect(screen.getByText('119.850 ₫').className).toContain('cell-number')
    expect(screen.getByText('30/10/2026')).toBeDefined()
    expect(screen.queryByText('119850')).toBeNull()
    expect(screen.queryByText('2026-10-30')).toBeNull()
    expect(badge('POSTED')?.textContent).toBe('Đã ghi sổ · v2')
    expect(headers()).not.toContain('Loại')
    expect(headers()).not.toContain('Đại lý')
    expect(statusTabs()).toEqual([
      ['Tất cả', 'true'],
      ['Nháp', 'false'],
      ['Đã ghi sổ', 'false'],
      ['Đã hủy', 'false'],
    ])
    expect(
      screen.queryByText('Dữ liệu và số tiền do máy chủ xác nhận.', {
        exact: false,
      }),
    ).toBeNull()
  })
  it('keeps the agency column and pending status on the stock issue list', async () => {
    const doc = detail('STOCK_ISSUE', {
      status: 'PENDING',
      currentRevision: revision({
        agencySnapshot: {
          name: 'Đại lý An Phát',
          address: null,
          phone: null,
          email: 'a@example.com',
        },
      }),
    })
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(
      response(page([summary(doc)])),
    )
    renderGoods(<StockIssuesPage />)
    await screen.findByText('Đại lý An Phát')
    expect(headers()).toContain('Đại lý')
    expect(headers()).not.toContain('Loại')
    expect(badge('PENDING')?.textContent).toBe('Chờ xử lý')
    expect(statusTabs().map(([label]) => label)).toContain('Chờ xử lý')
  })
  it('applies filters explicitly, uses opaque cursor, resets cursor and aborts obsolete reads', async () => {
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(
      response(page([summary()], 'opaque+cursor/=')),
    )
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    input('Tìm chứng từ', 'PN-100')
    expect(cache.cachedApiFetch).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(cache.cachedApiFetch).toHaveBeenCalledTimes(2))
    expect(String(vi.mocked(cache.cachedApiFetch).mock.calls[1]![0])).toContain(
      'cursor=opaque%2Bcursor%2F%3D',
    )
    const previousSignal = vi.mocked(cache.cachedApiFetch).mock.calls[1]![1]!
      .signal
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))
    await waitFor(() => expect(cache.cachedApiFetch).toHaveBeenCalledTimes(3))
    expect(String(vi.mocked(cache.cachedApiFetch).mock.calls[2]![0])).toContain(
      'q=PN-100',
    )
    expect(
      String(vi.mocked(cache.cachedApiFetch).mock.calls[2]![0]),
    ).not.toContain('cursor=')
    expect(previousSignal?.aborted).toBe(true)
  })
  it('does not fetch without kind read rights and rejects malformed list envelopes', async () => {
    const rendered = renderGoods(<StockReceiptsPage />, [])
    expect(cache.cachedApiFetch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Không có quyền')
    rendered.unmount()
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(response([summary()]))
    renderGoods(<StockReceiptsPage />)
    await screen.findByRole('alert')
    expect(screen.queryByText('PN-1')).toBeNull()
  })
  it('creates exact receipt payload from the product picker and retains key for uncertain retry, rotates for changed payload', async () => {
    vi.mocked(api.apiFetch).mockImplementation(async (path) => {
      if (path.startsWith('/products?')) return response({ items: products })
      throw new api.ApiError(0, 'NETWORK_ERROR', 'Offline')
    })
    renderGoods(<StockReceiptsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu' }))
    expect(screen.queryByLabelText('ID mặt hàng 1')).toBeNull()
    input('Ngày nghiệp vụ', '2026-10-01')
    await pick(
      within(lineGroup(1)).getByRole('combobox', { name: /Mặt hàng/ }),
      'SP-1 — Bút bi',
    )
    expect(
      String(
        vi
          .mocked(api.apiFetch)
          .mock.calls.find(([path]) => path.startsWith('/products?'))![0],
      ),
    ).toBe('/products?status=ACTIVE&limit=20')
    input('Số lượng 1', '999999999999999.999')
    input('Đơn giá nhập 1 (VNĐ)', '900719925474099301')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByText(/Kết quả chưa rõ/)
    const first = posts()[0]![1]!
    expect(posts()[0]![0]).toBe('/stock-receipts')
    expect(first.body).toEqual({
      businessDate: '2026-10-01',
      note: null,
      lines: [
        {
          productId: '9223372036854775807',
          quantity: '999999999999999.999',
          unitPrice: '900719925474099301',
        },
      ],
    })
    expect(first.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(posts()[1]![1]!.idempotencyKey).toBe(first.idempotencyKey)
    await screen.findByText(/Kết quả chưa rõ/)
    input('Ghi chú', 'New intent')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(posts()).toHaveLength(3))
    expect(posts()[2]![1]!.idempotencyKey).not.toBe(first.idempotencyKey)
  })
  it('rejects a missing product and zero receipt prices without Number coercion or writes', async () => {
    vi.mocked(api.apiFetch).mockImplementation(async (path) =>
      response(path.startsWith('/products?') ? { items: products } : {}),
    )
    renderGoods(<StockReceiptsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu' }))
    input('Ngày nghiệp vụ', '2026-10-01')
    input('Số lượng 1', '1')
    input('Đơn giá nhập 1 (VNĐ)', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByText(/Mã dòng\/mặt hàng không hợp lệ/)
    await pick(
      within(lineGroup(1)).getByRole('combobox', { name: /Mặt hàng/ }),
      'SP-1 — Bút bi',
    )
    input('Số lượng 1', '1e3')
    input('Đơn giá nhập 1 (VNĐ)', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByText(/Số lượng phải/)
    input('Số lượng 1', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByText(/Giá nhập phải/)
    expect(posts()).toHaveLength(0)
  })
  it('creates a stock issue with agency and product pickers sending exact ids', async () => {
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(response(page([])))
    vi.mocked(api.apiFetch).mockImplementation(async (path, options) => {
      if (path.startsWith('/agencies?'))
        return response({
          items: [{ id: '401', code: 'DL-401', name: 'Đại lý Minh Châu' }],
        })
      if (path.startsWith('/products?')) return response({ items: products })
      if (options?.method === 'POST') return response({ id: '1' })
      return response({})
    })
    renderGoods(<StockIssuesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu' }))
    expect(screen.queryByLabelText('ID đại lý')).toBeNull()
    await pick(
      within(lineGroup(1)).getByRole('combobox', { name: /Mặt hàng/ }),
      'SP-1 — Bút bi',
    )
    input('Số lượng 1', '2.5')
    input('Ngày nghiệp vụ', '2026-10-30')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByText('Vui lòng chọn đại lý.')
    await pick(
      screen.getByRole('combobox', { name: /Đại lý/ }),
      'DL-401 — Đại lý Minh Châu',
    )
    expect(
      vi
        .mocked(api.apiFetch)
        .mock.calls.some(
          ([path]) => path === '/agencies?status=ACTIVE&limit=20',
        ),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]![0]).toBe('/stock-issues')
    expect(posts()[0]![1]!.body).toEqual({
      businessDate: '2026-10-30',
      note: null,
      immediatePayment: '0',
      lines: [{ productId: '9223372036854775807', quantity: '2.5' }],
      agencyId: '401',
    })
  })
  it('posts PENDING/READY issue with parent ETag and key, not fictitious READY document status', async () => {
    const doc = detail('STOCK_ISSUE', {
      status: 'PENDING',
      currentRevision: revision({ state: 'READY' }),
    })
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(
      response(page([summary(doc)])),
    )
    vi.mocked(api.apiFetch).mockImplementation(async (_path, options) =>
      options?.method === 'POST' ? response({ id: '1' }) : response(doc),
    )
    renderGoods(<StockIssuesPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết PX-1' }),
    )
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('v1 · Sẵn sàng')
    expect(within(dialog).getByText('Chờ xử lý')).toBeDefined()
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi sổ' }))
    // Posting is irreversible: nothing is sent until the confirmation.
    expect(posts()).toHaveLength(0)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xác nhận ghi sổ' }),
    )
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/stock-issues/1/post',
        expect.objectContaining({
          method: 'POST',
          ifMatch: '"parent-v1"',
          idempotencyKey: expect.any(String),
        }),
      ),
    )
  })
  it('blocks stale posting and preserves form input after 412', async () => {
    vi.mocked(api.apiFetch).mockImplementation(async (_path, options) => {
      if (options?.method === 'PATCH')
        throw new api.ApiError(412, 'STALE', 'Version changed')
      return response(detail())
    })
    renderGoods(<StockReceiptsPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết PN-1' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Sửa thông tin nháp' }),
    )
    input('Ghi chú', 'Keep entered work')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByText('Version changed')
    expect((screen.getByLabelText('Ghi chú') as HTMLInputElement).value).toBe(
      'Keep entered work',
    )
    expect(
      vi
        .mocked(api.apiFetch)
        .mock.calls.find(([, options]) => options?.method === 'PATCH')?.[1],
    ).toMatchObject({
      ifMatch: '"parent-v1"',
      body: { businessDate: '2026-10-30', note: 'Keep entered work' },
    })
  })
  it('creates returns with originLineId chosen from the picked original posted invoice, loaded once', async () => {
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(response(page([])))
    const source = detail('STOCK_ISSUE', {
      id: '99',
      code: 'PX-99',
      status: 'POSTED',
      currentRevision: revision({ documentId: '99', state: 'POSTED' }),
    })
    vi.mocked(api.apiFetch).mockImplementation(async (path, options) => {
      if (path.startsWith('/stock-issues?'))
        return response({
          items: [
            {
              id: '99',
              code: 'PX-99',
              agencyName: 'Đại lý A',
              totalAmount: '119850',
            },
          ],
        })
      if (path === '/stock-issues/99') return response(source)
      if (options?.method === 'POST') return response({ id: '5' })
      return response({})
    })
    renderGoods(<SalesReturnsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu' }))
    expect(screen.queryByLabelText('ID phiếu xuất gốc')).toBeNull()
    const lineSelect = screen.getByLabelText(
      'Dòng bán gốc 1',
    ) as HTMLSelectElement
    expect(lineSelect.disabled).toBe(true)
    await pick(
      screen.getByRole('combobox', { name: /Phiếu xuất gốc/ }),
      'PX-99 — Đại lý A',
    )
    expect(
      vi
        .mocked(api.apiFetch)
        .mock.calls.some(
          ([path]) => path === '/stock-issues?status=POSTED&limit=20',
        ),
    ).toBe(true)
    await waitFor(() => expect(lineSelect.disabled).toBe(false))
    expect(Array.from(lineSelect.options).map((option) => option.text)).toEqual(
      ['Chọn dòng hàng đã bán…', 'Historical product — đã bán 1,001 Hộp'],
    )
    fireEvent.change(lineSelect, { target: { value: '201' } })
    input('Số lượng 1', '0.001')
    input('Ngày nghiệp vụ', '2026-10-30')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/sales-returns',
        expect.objectContaining({
          body: {
            originDocumentId: '99',
            businessDate: '2026-10-30',
            note: null,
            lines: [{ originLineId: '201', quantity: '0.001' }],
          },
        }),
      ),
    )
    expect(
      vi
        .mocked(api.apiFetch)
        .mock.calls.filter(([path]) => path === '/stock-issues/99'),
    ).toHaveLength(1)
    expect(posts()).toHaveLength(1)
  })
  it('falls back to a typed original issue number when issues are not readable', async () => {
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(response(page([])))
    vi.mocked(api.apiFetch).mockResolvedValue(response({ id: '5' }))
    renderGoods(<SalesReturnsPage />, ['returns.prepare'])
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu' }))
    expect(
      screen.queryByRole('combobox', { name: /Phiếu xuất gốc/ }),
    ).toBeNull()
    input('Mã số phiếu xuất gốc', '99')
    input('Mã dòng bán gốc 1', '201')
    input('Số lượng 1', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]![1]!.body).toMatchObject({
      originDocumentId: '99',
      lines: [{ originLineId: '201', quantity: '1' }],
    })
  })
})

const count = {
  id: '1',
  code: 'KK-1',
  state: 'DRAFT',
  countedAt: '2026-10-30T09:00:00+07:00',
  reason: null,
  adjustmentDocumentId: null,
  lines: [
    {
      id: '20',
      productId: '30',
      productCode: 'MH-30',
      productName: 'Count product',
      unitName: 'Hộp',
      bookQuantity: '1500',
      countedQuantity: '1500',
      difference: '0',
    },
  ],
}
describe('stock counts source workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'invalidateCache').mockImplementation(() => {})
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(response(page([count])))
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(count))
  })
  it.each(['0', '0.000', '-0.000', '0.001'])(
    'conditional confirmation uses exact difference %s',
    async (difference) => {
      vi.mocked(api.apiFetch).mockResolvedValue(
        response({ ...count, lines: [{ ...count.lines[0], difference }] }),
      )
      renderGoods(<StockCountsPage />, ['stock.count'])
      fireEvent.click(
        await screen.findByRole('button', { name: 'Chi tiết KK-1' }),
      )
      const button = await screen.findByRole('button', {
        name: 'Xác nhận kiểm kê',
      })
      expect((button as HTMLButtonElement).disabled).toBe(
        difference === '0.001',
      )
      if (difference === '0.001')
        expect(screen.getByText('+0,001').className).toContain('doc-diff--up')
    },
  )
  it('shows Vietnamese state labels, formatted times and quantities', async () => {
    renderGoods(<StockCountsPage />)
    const button = await screen.findByRole('button', { name: 'Chi tiết KK-1' })
    expect(button.textContent).toBe('Chi tiết')
    expect(badge('DRAFT')?.textContent).toBe('Nháp')
    expect(screen.queryByText('2026-10-30T09:00:00+07:00')).toBeNull()
    expect(
      screen.getAllByText(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/).length,
    ).toBeGreaterThan(0)
    const state = screen.getByRole('radiogroup', { name: 'Trạng thái kiểm kê' })
    expect(
      within(state)
        .getAllByRole('radio')
        .map((item) => item.textContent),
    ).toEqual(['Tất cả', 'Nháp', 'Đã xác nhận'])
    fireEvent.click(button)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByText('1.500')).toHaveLength(2)
    expect(
      within(dialog).getByRole('button', { name: 'Sửa số đếm MH-30' })
        .textContent,
    ).toBe('Sửa')
  })
  it('creates a count from the product picker with the exact product id', async () => {
    vi.mocked(api.apiFetch).mockImplementation(async (path, options) => {
      if (path.startsWith('/products?'))
        return response({
          items: [{ id: '30', code: 'MH-30', name: 'Count product' }],
        })
      if (options?.method === 'POST') return response(count)
      return response(count)
    })
    renderGoods(<StockCountsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Lập kiểm kê' }))
    expect(screen.queryByLabelText('ID mặt hàng 1')).toBeNull()
    input('Thời điểm đếm (ISO 8601, có múi giờ)', '2026-10-30T10:00:00+07:00')
    input('Số đếm thực tế 1', '5')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu số đếm' }))
    await screen.findByText(/Chọn mỗi mặt hàng một lần/)
    await pick(
      screen.getByRole('combobox', { name: /Mặt hàng 1/ }),
      'MH-30 — Count product',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Lưu số đếm' }))
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/stock-counts',
        expect.objectContaining({
          method: 'POST',
          body: {
            countedAt: '2026-10-30T10:00:00+07:00',
            reason: null,
            lines: [{ productId: '30', countedQuantity: '5' }],
          },
        }),
      ),
    )
  })
  it('requires new complete recount observations and sends parent ETag plus stable intent', async () => {
    renderGoods(<StockCountsPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết KK-1' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Đếm lại toàn bộ' }),
    )
    expect(
      (screen.getByLabelText('Số đếm thực tế 1') as HTMLInputElement).value,
    ).toBe('')
    expect(screen.getByText('MH-30 — Count product (Hộp)')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
    input('Thời điểm đếm (ISO 8601, có múi giờ)', '2026-10-30T10:00:00+07:00')
    input('Lý do kiểm kê', 'Fresh physical observations')
    input('Số đếm thực tế 1', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu số đếm' }))
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/stock-counts/1/recount',
        expect.objectContaining({
          ifMatch: '"parent-v1"',
          idempotencyKey: expect.any(String),
          body: {
            countedAt: '2026-10-30T10:00:00+07:00',
            reason: 'Fresh physical observations',
            lines: [{ productId: '30', countedQuantity: '0' }],
          },
        }),
      ),
    )
  })
  it('confirmed counts are immutable, no delete or mutation controls', async () => {
    vi.mocked(api.apiFetch).mockResolvedValue(
      response({ ...count, state: 'CONFIRMED', adjustmentDocumentId: '88' }),
    )
    renderGoods(<StockCountsPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết KK-1' }),
    )
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('#88')
    expect(within(dialog).getByText('Đã xác nhận')).toBeDefined()
    expect(
      screen.queryByRole('button', { name: 'Xác nhận kiểm kê' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đếm lại toàn bộ' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Sửa số đếm/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Xóa/ })).toBeNull()
  })
})

describe('goods workbench layout and new interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'invalidateCache').mockImplementation(() => {})
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary()], 'next-page')),
    )
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(detail()))
  })
  function listCalls() {
    return vi
      .mocked(cache.cachedApiFetch)
      .mock.calls.map(([path]) => String(path))
  }
  it('status segments filter immediately, reset the cursor and toggle back to all', async () => {
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(listCalls()[1]).toContain('cursor=next-page')
    fireEvent.click(screen.getByRole('radio', { name: 'Đã ghi sổ' }))
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    expect(listCalls()[2]).toBe(
      '/stock-receipts?status=POSTED&limit=25&sort=-businessDate',
    )
    expect(
      screen
        .getByRole('radio', { name: 'Đã ghi sổ' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    // Re-choosing the active segment keeps it; "Tất cả" clears the status.
    fireEvent.click(screen.getByRole('radio', { name: 'Đã ghi sổ' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Tất cả' }))
    await waitFor(() => expect(listCalls()).toHaveLength(4))
    expect(listCalls()[3]).not.toContain('status=')
  })
  it('sends picked agency/product filters only on apply and clears them', async () => {
    const issue = detail('STOCK_ISSUE')
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(
      response(page([summary(issue)])),
    )
    vi.mocked(api.apiFetch).mockImplementation(async (path) => {
      if (path.startsWith('/agencies?'))
        return response({
          items: [{ id: '401', code: 'DL-401', name: 'Đại lý Minh Châu' }],
        })
      if (path.startsWith('/products?')) return response({ items: products })
      return response({})
    })
    renderGoods(<StockIssuesPage />)
    await screen.findByText('PX-1')
    await pick(
      screen.getByRole('combobox', { name: /Đại lý/ }),
      'DL-401 — Đại lý Minh Châu',
    )
    await pick(
      screen.getByRole('combobox', { name: /Mặt hàng/ }),
      'SP-1 — Bút bi',
    )
    expect(listCalls()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(listCalls()[1]).toContain('agencyId=401')
    expect(listCalls()[1]).toContain('productId=9223372036854775807')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }))
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    expect(listCalls()[2]).toBe('/stock-issues?limit=25&sort=-businessDate')
    expect(screen.queryByRole('button', { name: 'Xóa lọc' })).toBeNull()
  })
  it('hides the agency filter for agencyless kinds and shows an empty state', async () => {
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(response(page([])))
    renderGoods(<StockAdjustmentsPage />)
    await screen.findByText('Không có chứng từ phù hợp.')
    expect(screen.queryByRole('combobox', { name: /Đại lý/ })).toBeNull()
    expect(screen.getByRole('combobox', { name: /Mặt hàng/ })).toBeDefined()
    expect(screen.queryByRole('radio', { name: 'Chờ xử lý' })).toBeNull()
  })
  it('opens the detail on row click and revision history from the row menu', async () => {
    renderGoods(<StockReceiptsPage />)
    fireEvent.click((await screen.findByText('PN-1')).closest('tr')!)
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Historical product')
    expect(within(dialog).getByText('Chi tiết PN-1')).toBeDefined()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Thao tác khác PN-1' }),
      { key: 'Enter' },
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Lịch sử phiên bản' }),
    )
    await screen.findByText('Lịch sử PN-1')
    await waitFor(() =>
      expect(
        listCalls().some((path) => path.startsWith('/documents/1/revisions?')),
      ).toBe(true),
    )
  })
  it('cancelling the post confirmation sends nothing', async () => {
    renderGoods(<StockReceiptsPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết PN-1' }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi sổ' }))
    expect(
      await screen.findByText(/sẽ tăng tồn kho và cập nhật giá nhập/),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Xác nhận ghi sổ' }),
      ).toBeNull(),
    )
    expect(posts()).toHaveLength(0)
  })
  it('estimates the receipt subtotal exactly and manages line rows', async () => {
    renderGoods(<StockReceiptsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu' }))
    const summaryPanel = screen.getByRole('complementary', {
      name: 'Tóm tắt chứng từ',
    })
    expect(
      (screen.getByRole('button', { name: 'Xóa dòng 1' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    input('Số lượng 1', '2.5')
    input('Đơn giá nhập 1 (VNĐ)', '1001')
    // 2.5 × 1001 = 2502.5, rounded half away from zero.
    expect(within(lineGroup(1)).getByText('2.503 ₫')).toBeDefined()
    expect(within(summaryPanel).getByText('2.503 ₫')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dòng' }))
    expect(lineGroup(2)).toBeDefined()
    expect(within(summaryPanel).getByText(/1 dòng chưa đủ/)).toBeDefined()
    input('Số lượng 2', '1e3')
    expect(within(lineGroup(2)).getByText('—')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dòng 2' }))
    expect(screen.queryByRole('group', { name: 'Dòng 2' })).toBeNull()
    expect(within(summaryPanel).queryByText(/dòng chưa đủ/)).toBeNull()
  })
  it('shows adjustment direction badges and increase/decrease counts', async () => {
    renderGoods(<StockAdjustmentsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu' }))
    expect(screen.getByText('Tạo điều chỉnh kho')).toBeDefined()
    input('Số lượng 1 (+/-)', '-3')
    expect(within(lineGroup(1)).getByText('Giảm')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dòng' }))
    input('Số lượng 2 (+/-)', '4.5')
    expect(within(lineGroup(2)).getByText('Tăng')).toBeDefined()
    const summaryPanel = screen.getByRole('complementary', {
      name: 'Tóm tắt chứng từ',
    })
    const counts = within(summaryPanel)
      .getAllByRole('definition')
      .map((item) => item.textContent)
    expect(counts).toEqual(['2', '1', '1'])
    expect(within(summaryPanel).queryByText('Tạm tính')).toBeNull()
  })
})

describe('stock count variance and confirmation', () => {
  const mixed = {
    ...count,
    lines: [
      count.lines[0],
      {
        ...count.lines[0],
        id: '21',
        productId: '31',
        productCode: 'MH-31',
        productName: 'Surplus product',
        countedQuantity: '1502',
        difference: '2',
      },
      {
        ...count.lines[0],
        id: '22',
        productId: '32',
        productCode: 'MH-32',
        productName: 'Short product',
        countedQuantity: '1499.5',
        difference: '-0.5',
      },
    ],
  }
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'invalidateCache').mockImplementation(() => {})
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(response(page([mixed])))
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(mixed))
  })
  it('highlights surplus and shortage with signed text and badges', async () => {
    renderGoods(<StockCountsPage />, ['stock.count', 'stock.adjustment.post'])
    expect(await screen.findByText('2 dòng lệch')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết KK-1' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Surplus product')
    const surplus = within(dialog).getByText('+2')
    expect(surplus.className).toContain('text-success')
    const shortage = within(dialog).getByText('-0,5')
    expect(shortage.className).toContain('doc-diff--down')
    expect(shortage.className).toContain('text-destructive')
    expect(within(shortage.closest('tr')!).getByText('Thiếu')).toBeDefined()
    expect(within(surplus.closest('tr')!).getByText('Thừa')).toBeDefined()
    expect(within(dialog).getByText('Khớp: 1')).toBeDefined()
    expect(within(dialog).getByText('Thừa: 1')).toBeDefined()
    expect(within(dialog).getByText('Thiếu: 1')).toBeDefined()
  })
  it('confirms only after the confirmation dialog, with ETag and intent key', async () => {
    renderGoods(<StockCountsPage />, ['stock.count', 'stock.adjustment.post'])
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết KK-1' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xác nhận kiểm kê' }),
    )
    expect(
      await screen.findByText(/2 dòng lệch sẽ được ghi thành phiếu điều chỉnh/),
    ).toBeDefined()
    expect(posts()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/stock-counts/1/confirm',
        expect.objectContaining({
          method: 'POST',
          ifMatch: '"parent-v1"',
          idempotencyKey: expect.any(String),
        }),
      ),
    )
    expect(cache.invalidateCache).toHaveBeenCalledWith('/stock-adjustments')
  })
  it('state segments filter counts and keep the code filter', async () => {
    renderGoods(<StockCountsPage />)
    await screen.findByText('KK-1')
    input('Mã kiểm kê', 'KK-9')
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Đã xác nhận' }))
    await waitFor(() =>
      expect(
        vi
          .mocked(cache.cachedApiFetch)
          .mock.calls.some(
            ([path]) =>
              path ===
              '/stock-counts?code=KK-9&state=CONFIRMED&limit=25&sort=-countedAt',
          ),
      ).toBe(true),
    )
  })
})
