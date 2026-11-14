import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentHistoryPage } from '../features/document_history/DocumentHistoryPage'
import type { DocumentDetail } from '../features/document_history/documentContracts'
import * as api from '../lib/api'
import * as cache from '../lib/cache'
import {
  allGoodsGrants,
  chainItem,
  detail,
  page,
  posted,
  renderGoods,
  response,
  summary,
  useToday,
} from './goodsFixtures'

const original = posted('STOCK_ISSUE', {
  id: '301',
  code: 'PX-301',
  status: 'CANCELLED',
  totalAmount: '1020000',
  cancelReason: 'Sai số lượng',
  replacedByDocumentId: '302',
  replacedBy: { id: '302', code: 'PX-302', status: 'POSTED' },
})
const replacement = posted('STOCK_ISSUE', {
  id: '302',
  code: 'PX-302',
  totalAmount: '510000',
  replacesDocumentId: '301',
  replaces: { id: '301', code: 'PX-301', status: 'CANCELLED' },
})
const docs: Record<string, DocumentDetail> = {
  '301': original,
  '302': replacement,
}

function serve(chain: DocumentDetail[] | Error = [original, replacement]) {
  vi.mocked(api.apiFetch).mockImplementation(async (path) => {
    const chainMatch = /^\/documents\/(\d+)\/chain$/.exec(path)
    if (chainMatch) {
      if (chain instanceof Error) throw chain
      return response({ items: chain.map(chainItem) }) as never
    }
    const docMatch = /^\/documents\/(\d+)$/.exec(path)
    const doc = docMatch ? docs[docMatch[1]!] : undefined
    if (doc) return response(doc) as never
    throw new Error(`unexpected ${path}`)
  })
}
async function openHistory(code = 'PX-301') {
  fireEvent.click(
    await screen.findByRole('button', { name: `Lịch sử ${code}` }),
  )
  return screen.findByRole('dialog', { name: `Lịch sử ${code}` })
}

beforeEach(() => {
  vi.restoreAllMocks()
  useToday()
  vi.spyOn(cache, 'cachedApiFetch').mockResolvedValue(
    response(
      page([summary(original), summary(detail('STOCK_RECEIPT'))]),
    ) as never,
  )
  vi.spyOn(api, 'apiFetch')
  vi.spyOn(api, 'apiDownload')
})
afterEach(() => {
  vi.useRealTimers()
})

describe('document history: replacement chain', () => {
  it('lists documents of every kind from /documents', async () => {
    serve()
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    await screen.findByText('PX-301')
    expect(screen.getByText('PN-1')).toBeDefined()
    expect(String(vi.mocked(cache.cachedApiFetch).mock.calls[0]![0])).toMatch(
      /^\/documents\?/,
    )
  })

  it('shows the chain from the original to the replacement with the reason', async () => {
    serve()
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    const dialog = await openHistory()
    const list = await within(dialog).findByRole('list', { name: 'Các phiếu' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]!.textContent).toContain('PX-301')
    expect(items[0]!.textContent).toContain('Phiếu gốc')
    expect(items[0]!.textContent).toContain('Lý do: Sai số lượng')
    expect(items[1]!.textContent).toContain('PX-302')
    expect(api.apiFetch).toHaveBeenCalledWith(
      '/documents/301/chain',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    // The chosen step's content is read from /documents/{id}.
    await within(dialog).findByText('Đã được thay bằng PX-302 (Đã ghi sổ)')
    expect(
      within(dialog)
        .getByRole('button', { name: 'Xem PX-301' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('switches the shown document when another step is chosen', async () => {
    serve()
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    const dialog = await openHistory()
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Xem PX-302' }),
    )
    await within(dialog).findByText('Thay thế cho PX-301 (Đã hủy)')
    expect(api.apiFetch).toHaveBeenCalledWith(
      '/documents/302',
      expect.anything(),
    )
  })

  it('says when a document was never corrected (single-item chain)', async () => {
    serve([original])
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    const dialog = await openHistory()
    expect(
      await within(dialog).findByText('Phiếu chưa từng được sửa có lý do.'),
    ).toBeDefined()
    expect(within(dialog).queryByText('Phiếu gốc')).toBeNull()
  })

  it('shows a chain error with retry', async () => {
    serve(new Error('Không đọc được chuỗi'))
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    const dialog = await openHistory()
    expect(
      await within(dialog).findByText('Không đọc được chuỗi', { exact: false }),
    ).toBeDefined()
    serve()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thử lại' }))
    await within(dialog).findByRole('list', { name: 'Các phiếu' })
  })

  it('offers no line editing or deleting in history', async () => {
    serve()
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    const dialog = await openHistory()
    await within(dialog).findByText('Đã được thay bằng PX-302 (Đã ghi sổ)')
    for (const name of ['Sửa', 'Xóa', 'Sửa nháp', 'Xóa nháp', 'Hủy'])
      expect(within(dialog).queryByRole('button', { name })).toBeNull()
  })
})

describe('document history: print', () => {
  it('previews HTML in a sandboxed frame and reports a PDF failure', async () => {
    serve()
    vi.mocked(api.apiDownload)
      .mockResolvedValueOnce({
        data: new Blob(['<p>Bản in</p>'], { type: 'text/html' }),
        status: 200,
        etag: null,
      })
      .mockRejectedValueOnce(new Error('Không tạo được PDF'))
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:print-301'),
      revokeObjectURL: vi.fn(),
    })
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    const dialog = await openHistory()
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Xem bản in' }),
    )
    const frame = await within(dialog).findByTitle('Bản HTML PX-301')
    expect(frame.getAttribute('src')).toBe('blob:print-301')
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(api.apiDownload).toHaveBeenCalledWith(
      '/documents/301/print',
      expect.objectContaining({ headers: { Accept: 'text/html' } }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tải PDF' }))
    await within(dialog).findByText('Không tạo được PDF', { exact: false })
    expect(api.apiDownload).toHaveBeenLastCalledWith(
      '/documents/301/print',
      expect.objectContaining({ headers: { Accept: 'application/pdf' } }),
    )
  })

  it('downloads a PDF named after the document code', async () => {
    serve()
    vi.mocked(api.apiDownload).mockResolvedValueOnce({
      data: new Blob(['%PDF'], { type: 'application/pdf' }),
      status: 200,
      etag: null,
    })
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:pdf-301'),
      revokeObjectURL: vi.fn(),
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('PX-301.pdf')
        expect(this.href).toBe('blob:pdf-301')
      })
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    const dialog = await openHistory()
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Tải PDF' }),
    )
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
  })

  it('closes the history dialog', async () => {
    serve()
    renderGoods(<DocumentHistoryPage />, allGoodsGrants)
    await openHistory()
    fireEvent.click(screen.getByRole('button', { name: /Đóng hộp thoại/i }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Lịch sử PX-301' }),
      ).toBeNull(),
    )
  })
})
