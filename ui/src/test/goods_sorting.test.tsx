import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StockReceiptsPage } from '../features/stock_receipts/StockReceiptsPage'
import { StockIssuesPage } from '../features/stock_issues/StockIssuesPage'
import { PaymentReceiptsPage } from '../features/payment_receipts/PaymentReceiptsPage'
import {
  pageTotal,
  statusParts,
  lifecycleSteps,
  valueByDay,
} from '../features/document_history/insightsModel'
import * as api from '../lib/api'
import * as cache from '../lib/cache'
import {
  detail,
  page,
  posted,
  renderGoods,
  response,
  summary,
} from './goodsFixtures'

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

describe('document list columns and filters per kind', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'apiFetch').mockResolvedValue(response(detail()))
  })

  it('shows the agency column on issues and the method column on payments', async () => {
    const issue = detail('STOCK_ISSUE')
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary(issue)])),
    )
    const view = renderGoods(<StockIssuesPage />)
    await screen.findByText('Đại lý An Phát')
    expect(screen.getByRole('columnheader', { name: 'Đại lý' })).toBeDefined()
    expect(screen.queryByRole('columnheader', { name: 'Hình thức' })).toBeNull()
    view.unmount()
    const payment = detail('PAYMENT_RECEIPT', { receiptType: 'BANK_TRANSFER' })
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(
      response(page([summary(payment)])),
    )
    renderGoods(<PaymentReceiptsPage />)
    await screen.findByText('PT-1')
    expect(
      screen.getByRole('columnheader', { name: 'Hình thức' }),
    ).toBeDefined()
    expect(screen.getAllByText('Chuyển khoản').length).toBeGreaterThan(0)
  })

  it('hides the agency column on receipts and offers only the three statuses', async () => {
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary(detail('STOCK_RECEIPT'))])),
    )
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-1')
    expect(screen.queryByRole('columnheader', { name: 'Đại lý' })).toBeNull()
    const group = screen.getByRole('radiogroup', {
      name: 'Lọc theo trạng thái',
    })
    expect(
      within(group)
        .getAllByRole('radio')
        .map((item) => item.textContent),
    ).toEqual(['Tất cả', 'Nháp', 'Đã ghi sổ', 'Đã hủy'])
  })

  it('marks replaced and replacement documents next to their status', async () => {
    const old = posted('STOCK_RECEIPT', {
      status: 'CANCELLED',
      replacedByDocumentId: '2',
    })
    const replacement = posted('STOCK_RECEIPT', {
      id: '2',
      code: 'PN-2',
      replacesDocumentId: '1',
    })
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary(old), summary(replacement)])),
    )
    renderGoods(<StockReceiptsPage />)
    await screen.findByText('PN-2')
    const badges = [...document.querySelectorAll('.badge[data-status]')].map(
      (badge) => badge.textContent,
    )
    expect(badges).toContain('Đã hủy · đã thay thế')
    expect(badges).toContain('Đã ghi sổ · phiếu thay thế')
  })

  it('filters payments by receipt type on apply', async () => {
    vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
      response(page([summary(detail('PAYMENT_RECEIPT'))])),
    )
    renderGoods(<PaymentReceiptsPage />)
    await screen.findByText('PT-1')
    fireEvent.change(screen.getByLabelText('Hình thức thu'), {
      target: { value: 'ONLINE' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))
    await waitFor(() =>
      expect(listCalls().at(-1)).toContain('receiptType=ONLINE'),
    )
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

  it('maps statuses onto the draft → posted → cancelled rail', () => {
    expect(lifecycleSteps('DRAFT').steps.map((s) => s.key)).toEqual([
      'draft',
      'posted',
      'change',
    ])
    expect(lifecycleSteps('POSTED').current).toBe(1)
    expect(lifecycleSteps('DRAFT').current).toBe(0)
    const cancelled = lifecycleSteps('CANCELLED')
    expect(cancelled.steps.at(-1)?.key).toBe('cancelled')
    expect(cancelled.current).toBe(cancelled.steps.length - 1)
  })
})

describe('lifecycle visuals', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('marks the current lifecycle step in the document detail', async () => {
    const doc = posted('STOCK_ISSUE')
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
    expect(steps).toHaveLength(3)
    expect(steps[1]!.getAttribute('aria-current')).toBe('step')
    expect(steps[0]!.getAttribute('aria-current')).toBeNull()
  })
})
