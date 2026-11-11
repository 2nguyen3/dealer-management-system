import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StockReceiptsPage } from '../features/stock_receipts/StockReceiptsPage'
import { StockCountsPage } from '../features/stock_counts/StockCountsPage'
import { StockIssuesPage } from '../features/stock_issues/StockIssuesPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { RevisionHistory } from '../features/document_history/DocumentHistoryPage'
import {
  pageTotal,
  statusParts,
  lifecycleSteps,
  valueByDay,
} from '../features/document_history/insightsModel'
import * as api from '../lib/api'
import * as cache from '../lib/cache'
import { detail, page, renderGoods, response, summary } from './goodsFixtures'

function listCalls() {
  return vi
    .mocked(cache.cachedApiFetch)
    .mock.calls.map(([path]) => String(path))
}
function sortOf(path: string | undefined) {
  return new URLSearchParams(path?.split('?')[1] ?? '').get('sort')
}
function header(name: string) {
  return screen.getByRole('columnheader', { name })
}
function clickHeader(name: string) {
  fireEvent.click(within(header(name)).getByRole('button'))
}

describe('document list server sorting', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary()], 'next-page')),
    )
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(detail()))
  })

  it('starts on the contract default and marks the date header descending', async () => {
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    expect(sortOf(listCalls()[0])).toBe('-businessDate')
    expect(header('Ngày').getAttribute('aria-sort')).toBe('descending')
    expect(header('Tổng tiền').getAttribute('aria-sort')).toBe('none')
    // Unsortable columns stay plain headers.
    expect(header('Mã chứng từ').getAttribute('aria-sort')).toBeNull()
  })

  it('date header toggles ascending then returns to the default order', async () => {
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    clickHeader('Ngày')
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(listCalls()[1]).toBe('/stock-receipts?limit=25&sort=businessDate')
    await screen.findByText('PN-1')
    expect(header('Ngày').getAttribute('aria-sort')).toBe('ascending')
    clickHeader('Ngày')
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    // Never sends an empty sort: clearing falls back to the contract default.
    expect(sortOf(listCalls()[2])).toBe('-businessDate')
  })

  it('total header cycles -totalAmount → totalAmount → default and resets the cursor', async () => {
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(listCalls()[1]).toContain('cursor=next-page')
    await screen.findByText('PN-1')
    clickHeader('Tổng tiền')
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    expect(sortOf(listCalls()[2])).toBe('-totalAmount')
    expect(listCalls()[2]).not.toContain('cursor=')
    await screen.findByText('PN-1')
    expect(header('Ngày').getAttribute('aria-sort')).toBe('none')
    clickHeader('Tổng tiền')
    await waitFor(() => expect(listCalls()).toHaveLength(4))
    expect(sortOf(listCalls()[3])).toBe('totalAmount')
    await screen.findByText('PN-1')
    clickHeader('Tổng tiền')
    await waitFor(() => expect(listCalls()).toHaveLength(5))
    expect(sortOf(listCalls()[4])).toBe('-businessDate')
  })

  it('sort menu offers only contract fields and keeps the direction', async () => {
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    fireEvent.keyDown(screen.getByRole('button', { name: /Ngày chứng từ/ }), {
      key: 'Enter',
    })
    const options = (await screen.findAllByRole('menuitemradio')).map(
      (item) => item.textContent,
    )
    expect(options).toContain('Thời điểm lập')
    expect(options).toContain('Tổng tiền')
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Thời điểm lập' }),
    )
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(sortOf(listCalls()[1])).toBe('-createdAt')
  })

  it('counts active filters, shows reset only while filtered and clears status', async () => {
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    expect(screen.queryByLabelText(/bộ lọc đang áp dụng/)).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Đã ghi sổ' }))
    await screen.findByLabelText('1 bộ lọc đang áp dụng')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }))
    await waitFor(() =>
      expect(listCalls().at(-1)).toBe(
        '/stock-receipts?limit=25&sort=-businessDate',
      ),
    )
    expect(screen.queryByRole('button', { name: 'Xóa lọc' })).toBeNull()
  })

  it('labels the visual summary as page-only when more pages exist', async () => {
    renderGoods(<StockReceiptsPage />)
    const region = await screen.findByRole('region', {
      name: 'Tổng quan danh sách',
    })
    expect(
      within(region).getAllByText('Trang hiện tại').length,
    ).toBeGreaterThan(0)
  })

  it('labels the summary as the full result on a single complete page and hides it when empty', async () => {
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(
      response(page([summary()])),
    )
    const view = renderGoods(<StockReceiptsPage />)
    const region = await screen.findByRole('region', {
      name: 'Tổng quan danh sách',
    })
    expect(within(region).queryByText('Trang hiện tại')).toBeNull()
    expect(
      within(region).getAllByText('Toàn bộ kết quả').length,
    ).toBeGreaterThan(0)
    view.unmount()
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(response(page([])))
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('Không có chứng từ phù hợp.')
    expect(
      screen.queryByRole('region', { name: 'Tổng quan danh sách' }),
    ).toBeNull()
  })
})

describe('stock count and inventory sorting', () => {
  const count = {
    id: '1',
    code: 'KK-1',
    state: 'DRAFT',
    countedAt: '2026-10-30T09:00:00+07:00',
    reason: null,
    adjustmentDocumentId: null,
    lines: [],
  }
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(response(page([count])))
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(count))
  })

  it('stock counts sort by countedAt and id only', async () => {
    renderGoods(<StockCountsPage />)
    await screen.findByText('KK-1')
    expect(sortOf(listCalls()[0])).toBe('-countedAt')
    expect(header('Thời điểm đếm').getAttribute('aria-sort')).toBe('descending')
    clickHeader('Thời điểm đếm')
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(sortOf(listCalls()[1])).toBe('countedAt')
    await screen.findByText('KK-1')
    clickHeader('Mã')
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    expect(sortOf(listCalls()[2])).toBe('-id')
    await screen.findByText('KK-1')
    // Reason/state columns are not contract sort fields.
    expect(header('Lý do').getAttribute('aria-sort')).toBeNull()
  })

  it('inventory re-reads the product overview in the chosen server order', async () => {
    vi.mocked(api.apiFetch).mockResolvedValue(
      response({
        items: [
          {
            id: '1',
            code: 'SP-1',
            name: 'Bút bi',
            unitName: 'Cây',
            currentStock: '5',
            lowStockThreshold: '10',
          },
        ],
        pagination: { limit: 100, hasMore: false, nextCursor: null },
      }),
    )
    renderGoods(<InventoryPage />, ['inventory.read'])
    await screen.findByText('SP-1')
    const paths = () =>
      vi.mocked(api.apiFetch).mock.calls.map(([path]) => String(path))
    expect(paths()).toEqual(['/products?limit=100&sort=name'])
    expect(header('Tên mặt hàng').getAttribute('aria-sort')).toBe('ascending')
    clickHeader('Tồn hiện tại')
    await waitFor(() =>
      expect(paths().at(-1)).toBe('/products?limit=100&sort=currentStock'),
    )
    await screen.findByText('SP-1')
    clickHeader('Tồn hiện tại')
    await waitFor(() =>
      expect(paths().at(-1)).toBe('/products?limit=100&sort=-currentStock'),
    )
    await screen.findByText('SP-1')
    clickHeader('Tồn hiện tại')
    await waitFor(() =>
      expect(paths().at(-1)).toBe('/products?limit=100&sort=name'),
    )
    await screen.findByText('SP-1')
    clickHeader('Tên mặt hàng')
    await waitFor(() =>
      expect(paths().at(-1)).toBe('/products?limit=100&sort=-name'),
    )
  })
})

describe('revision history order', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(response(page([])))
  })

  it('switches between newest and oldest revision first', async () => {
    renderGoods(<RevisionHistory doc={summary()} onClose={() => undefined} />)
    await waitFor(() => expect(listCalls()).toHaveLength(1))
    expect(sortOf(listCalls()[0])).toBe('-revisionNo')
    fireEvent.click(screen.getByRole('radio', { name: 'Cũ nhất' }))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(sortOf(listCalls()[1])).toBe('revisionNo')
    // Re-choosing the active order keeps it (no empty sort).
    fireEvent.click(screen.getByRole('radio', { name: 'Cũ nhất' }))
    expect(listCalls()).toHaveLength(2)
  })
})

describe('document summary helpers', () => {
  it('sums exact totals and skips malformed amounts', () => {
    const a = summary(detail())
    expect(pageTotal([a, { ...a, totalAmount: '1' }])).toBe(900719925474099302n)
    expect(pageTotal([{ ...a, totalAmount: 'x' }])).toBe(0n)
    expect(pageTotal([])).toBe(0n)
  })

  it('orders statuses by lifecycle and drops empty ones', () => {
    const a = summary(detail())
    const parts = statusParts([
      { ...a, status: 'POSTED' },
      { ...a, status: 'DRAFT' },
      { ...a, status: 'POSTED' },
    ])
    expect(parts.map((part) => [part.key, part.value])).toEqual([
      ['DRAFT', 1],
      ['POSTED', 2],
    ])
    expect(statusParts([])).toEqual([])
  })

  it('groups value by business date oldest first', () => {
    const a = summary(detail())
    const days = valueByDay([
      { ...a, businessDate: '2026-10-31', totalAmount: '5' },
      { ...a, businessDate: '2026-10-30', totalAmount: '2' },
      { ...a, businessDate: '2026-10-31', totalAmount: 'bad' },
    ])
    expect(days.map((day) => [day.label, day.exact])).toEqual([
      ['30/10', '2'],
      ['31/10', '5'],
    ])
  })

  it('maps statuses onto lifecycle steps per kind', () => {
    expect(
      lifecycleSteps('STOCK_ISSUE', 'PENDING').steps.map((s) => s.key),
    ).toEqual(['draft', 'pending', 'posted', 'change'])
    expect(lifecycleSteps('STOCK_ISSUE', 'PENDING').current).toBe(1)
    expect(lifecycleSteps('STOCK_RECEIPT', 'POSTED').current).toBe(1)
    expect(lifecycleSteps('STOCK_RECEIPT', 'DRAFT').current).toBe(0)
    const cancelled = lifecycleSteps('STOCK_RECEIPT', 'CANCELLED')
    expect(cancelled.steps.at(-1)?.key).toBe('cancelled')
    expect(cancelled.current).toBe(cancelled.steps.length - 1)
  })
})

describe('lifecycle and variance visuals', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('marks the current lifecycle step in the document detail', async () => {
    const doc = detail('STOCK_ISSUE', { status: 'PENDING' })
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary(doc)])),
    )
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(doc))
    renderGoods(<StockIssuesPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết PX-1' }),
    )
    const dialog = await screen.findByRole('dialog')
    const rail = await within(dialog).findByRole('list', {
      name: 'Vòng đời chứng từ',
    })
    const steps = within(rail).getAllByRole('listitem')
    expect(steps.map((step) => step.textContent)).toEqual([
      'Lập phiếu',
      'Chờ xuất',
      'Ghi sổ',
      'Sửa sai/Hủy',
    ])
    expect(steps[1]!.getAttribute('aria-current')).toBe('step')
    expect(steps[0]!.getAttribute('aria-current')).toBeNull()
  })

  it('shows the match meter, variance chart and two-step rail for a confirmed count', async () => {
    const line = {
      id: '20',
      productId: '30',
      productCode: 'MH-30',
      productName: 'Count product',
      unitName: 'Hộp',
      bookQuantity: '4',
      countedQuantity: '4',
      difference: '0',
    }
    const count = {
      id: '1',
      code: 'KK-1',
      state: 'CONFIRMED',
      countedAt: '2026-10-30T09:00:00+07:00',
      reason: null,
      adjustmentDocumentId: null,
      lines: [
        line,
        { ...line, id: '21', difference: '-1', countedQuantity: '3' },
      ],
    }
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(response(page([count])))
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(count))
    renderGoods(<StockCountsPage />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết KK-1' }),
    )
    const dialog = await screen.findByRole('dialog')
    const meter = await within(dialog).findByRole('meter', {
      name: 'Tỷ lệ dòng khớp sổ',
    })
    expect(meter.getAttribute('aria-valuenow')).toBe('50')
    expect(within(dialog).getByText('Chênh lệch theo mặt hàng')).toBeDefined()
    const rail = within(dialog).getByRole('list', { name: 'Vòng đời biên bản' })
    // Confirmed without an adjustment document: two steps, the last current.
    const steps = within(rail).getAllByRole('listitem')
    expect(steps.map((step) => step.textContent)).toEqual(['Đếm', 'Xác nhận'])
    expect(steps[1]!.getAttribute('aria-current')).toBe('step')
  })
})
