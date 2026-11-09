import { fireEvent, screen, waitFor } from '@testing-library/react'
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

function input(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
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
      fireEvent.click(
        screen.getByRole('button', { name: `Chi tiết ${doc.code}` }),
      )
      await screen.findByText('Historical product (#301)')
      expect(api.apiFetch).toHaveBeenCalledTimes(1)
      expect(api.apiFetch).toHaveBeenCalledWith(
        `${path}/1`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
      expect(screen.getAllByText('900719925474099301').length).toBeGreaterThan(
        0,
      )
    },
  )
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
  it('creates exact receipt payload and retains key for uncertain retry, rotates for changed payload', async () => {
    vi.mocked(api.apiFetch).mockRejectedValue(
      new api.ApiError(0, 'NETWORK_ERROR', 'Offline'),
    )
    renderGoods(<StockReceiptsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Lập phiếu mới' }))
    input('Ngày nghiệp vụ', '2026-10-01')
    input('ID mặt hàng 1', '9223372036854775807')
    input('Số lượng 1', '999999999999999.999')
    input('Đơn giá nhập 1 (VNĐ)', '900719925474099301')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng từ' }))
    await screen.findByText(/Kết quả chưa rõ/)
    const first = vi.mocked(api.apiFetch).mock.calls[0]![1]!
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
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng từ' }))
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.apiFetch).mock.calls[1]![1]!.idempotencyKey).toBe(
      first.idempotencyKey,
    )
    await screen.findByText(/Kết quả chưa rõ/)
    input('Ghi chú', 'New intent')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng từ' }))
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(3))
    expect(vi.mocked(api.apiFetch).mock.calls[2]![1]!.idempotencyKey).not.toBe(
      first.idempotencyKey,
    )
  })
  it('rejects zero receipt prices without Number coercion or requests', async () => {
    renderGoods(<StockReceiptsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Lập phiếu mới' }))
    input('Ngày nghiệp vụ', '2026-10-01')
    input('ID mặt hàng 1', '1')
    input('Số lượng 1', '1e3')
    input('Đơn giá nhập 1 (VNĐ)', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng từ' }))
    await screen.findByText(/Số lượng phải/)
    input('Số lượng 1', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng từ' }))
    await screen.findByText(/Giá nhập phải/)
    expect(api.apiFetch).not.toHaveBeenCalled()
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
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi sổ' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng từ' }))
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
  it('creates returns with originLineId only and demand-loads original posted invoice once', async () => {
    vi.mocked(cache.cachedApiFetch).mockResolvedValue(response(page([])))
    vi.mocked(api.apiFetch).mockResolvedValue(
      response(
        detail('STOCK_ISSUE', {
          id: '99',
          status: 'POSTED',
          currentRevision: revision({ documentId: '99', state: 'POSTED' }),
        }),
      ),
    )
    renderGoods(<SalesReturnsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Lập phiếu mới' }))
    input('ID phiếu xuất gốc', '99')
    expect(api.apiFetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu xuất gốc' }))
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Chọn dòng 201: Historical product',
      }),
    )
    input('Số lượng 1', '0.001')
    input('Ngày nghiệp vụ', '2026-10-30')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chứng từ' }))
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
    expect(api.apiFetch).toHaveBeenCalledTimes(2)
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
      bookQuantity: '10',
      countedQuantity: '10',
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
    },
  )
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
    input('Thời điểm đếm (ISO 8601, có múi giờ)', '2026-10-30T10:00:00+07:00')
    input('Lý do kiểm kê', 'Fresh physical observations')
    input('Số đếm thực tế 1', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu quan sát' }))
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
    await screen.findByText('Phiếu điều chỉnh liên kết: 88')
    expect(
      screen.queryByRole('button', { name: 'Xác nhận kiểm kê' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đếm lại toàn bộ' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Xóa/ })).toBeNull()
  })
})
