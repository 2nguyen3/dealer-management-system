import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { JSX } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentReceiptsPage } from '../features/payment_receipts/PaymentReceiptsPage'
import { StockIssuesPage } from '../features/stock_issues/StockIssuesPage'
import { StockReceiptsPage } from '../features/stock_receipts/StockReceiptsPage'
import type { DocumentDetail } from '../features/document_history/documentContracts'
import * as api from '../lib/api'
import { ApiError, type RequestOptions } from '../lib/api'
import * as cache from '../lib/cache'
import type { FunctionCode } from '../lib/types'
import {
  agency,
  allGoodsGrants,
  currentLocation,
  detail,
  page,
  posted,
  product,
  renderGoods,
  response,
  summary,
  TODAY,
  useToday,
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

type Handler = (
  path: string,
  options: RequestOptions,
) => unknown | Promise<unknown>

/**
 * Routes `apiFetch` by path: agency/product reads return fixtures, `GET`
 * of a document returns `doc`, writes go to `write` (default: echo `doc`).
 */
function serve(doc: DocumentDetail, write?: Handler, agencyData = agency()) {
  vi.mocked(api.apiFetch).mockImplementation(async (path, options = {}) => {
    const method = options.method ?? 'GET'
    if (method === 'GET') {
      if (path.startsWith('/agencies/')) return response(agencyData)
      if (path.startsWith('/agencies?')) return response(page([agencyData]))
      if (path.startsWith('/products/')) return response(product())
      if (path.startsWith('/products?')) return response(page([product()]))
      return response(doc)
    }
    const result = write ? await write(path, options) : response(doc)
    if (result instanceof Error) throw result
    return result as never
  })
}
function writes() {
  return vi
    .mocked(api.apiFetch)
    .mock.calls.filter(([, options]) => (options?.method ?? 'GET') !== 'GET')
}
function button(name: string | RegExp) {
  return screen.getByRole('button', { name })
}
async function openDetail(code: string) {
  fireEvent.click(
    await screen.findByRole('button', { name: `Chi tiết ${code}` }),
  )
  await screen.findByRole('dialog', { name: `Chi tiết ${code}` })
}
function render(
  Page: () => JSX.Element,
  doc: DocumentDetail,
  grants: FunctionCode[] = allGoodsGrants,
  url = '/',
) {
  vi.mocked(cache.cachedApiFetch).mockResolvedValue(
    response(page([summary(doc)])) as never,
  )
  return renderGoods(<Page />, grants, url)
}

beforeEach(() => {
  vi.restoreAllMocks()
  useToday()
  vi.spyOn(cache, 'invalidateCache').mockImplementation(() => {})
  vi.spyOn(cache, 'cachedApiFetch')
  vi.spyOn(api, 'apiFetch')
})
afterEach(() => {
  vi.useRealTimers()
})

describe('document workbench: list and detail', () => {
  it.each([
    [StockReceiptsPage, 'STOCK_RECEIPT', '/stock-receipts'],
    [StockIssuesPage, 'STOCK_ISSUE', '/stock-issues'],
    [PaymentReceiptsPage, 'PAYMENT_RECEIPT', '/payment-receipts'],
  ] as const)(
    'loads one bounded list and demand-loads the %s detail',
    async (Page, kind, path) => {
      const doc = detail(kind)
      serve(doc)
      render(Page, doc)
      await screen.findByText(doc.code)
      expect(cache.cachedApiFetch).toHaveBeenCalledWith(
        `${path}?limit=25&sort=-businessDate`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
      expect(api.apiFetch).not.toHaveBeenCalled()
      await openDetail(doc.code)
      expect(api.apiFetch).toHaveBeenCalledWith(
        `${path}/1`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    },
  )

  it('formats exact amounts and quantities without Number coercion', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc)
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    const dialog = screen.getByRole('dialog', { name: 'Chi tiết PN-1' })
    expect(
      within(dialog).getAllByText('900.719.925.474.099.301 ₫').length,
    ).toBeGreaterThan(0)
    expect(within(dialog).getByText('1,001')).toBeDefined()
    expect(within(dialog).queryByText('900719925474099301')).toBeNull()
  })

  it('does not read anything without a read grant for the kind', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc)
    render(StockReceiptsPage, doc, ['agency.read'])
    await waitFor(() => expect(cache.cachedApiFetch).not.toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Tạo phiếu' })).toBeNull()
  })

  it('reports a detail whose kind does not match the page', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(detail('STOCK_ISSUE'))
    render(StockReceiptsPage, doc)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Chi tiết PN-1' }),
    )
    expect(
      await screen.findByText('Sai loại chứng từ.', { exact: false }),
    ).toBeDefined()
    // Nothing of the wrong document is shown or actionable.
    expect(screen.queryByRole('button', { name: 'Ghi sổ' })).toBeNull()
  })

  it('opens a deep-linked document and clears the URL', async () => {
    const doc = detail('STOCK_RECEIPT', { id: '5', code: 'PN-5' })
    serve(doc)
    render(StockReceiptsPage, doc, allGoodsGrants, '/?document=5')
    await screen.findByRole('dialog', { name: 'Chi tiết PN-5' })
    expect(api.apiFetch).toHaveBeenCalledWith(
      '/stock-receipts/5',
      expect.anything(),
    )
    await waitFor(() => expect(currentLocation()).toBe('/'))
  })

  it('ignores a malformed deep-linked id', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc)
    render(StockReceiptsPage, doc, allGoodsGrants, '/?document=abc')
    await screen.findByText('PN-1')
    await waitFor(() => expect(currentLocation()).toBe('/'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it('shows replacement links and opens the linked document', async () => {
    const doc = posted('STOCK_RECEIPT', {
      id: '9',
      code: 'PN-9',
      replaces: { id: '7', code: 'PN-7', status: 'CANCELLED' },
      replacesDocumentId: '7',
    })
    serve(doc)
    render(StockReceiptsPage, doc)
    await openDetail('PN-9')
    const link = button('Thay thế cho PN-7 (Đã hủy)')
    fireEvent.click(link)
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/stock-receipts/7',
        expect.anything(),
      ),
    )
  })
})

describe('document workbench: drafts', () => {
  it('creates a payment receipt from the prefilled deep link (A2) without agencyId edits', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc, () => response(doc, '"created-v1"'))
    render(
      PaymentReceiptsPage,
      doc,
      allGoodsGrants,
      '/payment-receipts?new=1&agencyId=401&amount=200000',
    )
    await screen.findByRole('dialog', { name: 'Tạo phiếu thu tiền' })
    expect(
      (
        screen.getByLabelText('Số tiền thu (VNĐ)', {
          exact: false,
        }) as HTMLInputElement
      ).value,
    ).toBe('200000')
    // Debt panel: current 500.000, after 300.000.
    const panel = await screen.findByLabelText('Công nợ đại lý')
    expect(panel.textContent).toContain('500.000 ₫')
    expect(panel.textContent).toContain('300.000 ₫')
    fireEvent.click(button('Lưu nháp'))
    await waitFor(() => expect(writes()).toHaveLength(1))
    const [path, options] = writes()[0]!
    expect(path).toBe('/payment-receipts')
    expect(options).toMatchObject({
      method: 'POST',
      body: {
        businessDate: TODAY,
        note: null,
        agencyId: '401',
        receiptType: 'CASH',
        amount: '200000',
      },
    })
    expect(options?.ifMatch).toBeUndefined()
    await screen.findByText('Đã lưu nháp PT-1.')
  })

  it.each([
    ['600000', 'Số tiền thu không được vượt nợ hiện tại (500.000 ₫).'],
    ['500001', 'Số tiền thu không được vượt nợ hiện tại (500.000 ₫).'],
  ])('blocks a payment of %s above the current debt', async (amount, error) => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc)
    render(
      PaymentReceiptsPage,
      doc,
      allGoodsGrants,
      `/payment-receipts?new=1&agencyId=401&amount=${amount}`,
    )
    await screen.findByRole('dialog', { name: 'Tạo phiếu thu tiền' })
    await screen.findByText('Thu toàn bộ nợ 500.000 ₫')
    fireEvent.click(button('Lưu nháp'))
    expect(await screen.findByText(error)).toBeDefined()
    expect(writes()).toHaveLength(0)
  })

  it('accepts exactly the current debt and offers "Thu toàn bộ nợ"', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc)
    render(
      PaymentReceiptsPage,
      doc,
      allGoodsGrants,
      '/payment-receipts?new=1&agencyId=401',
    )
    fireEvent.click(await screen.findByText('Thu toàn bộ nợ 500.000 ₫'))
    fireEvent.click(button('Lưu nháp'))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]![1]?.body).toMatchObject({ amount: '500000' })
  })

  it('refuses a payment when the agency owes nothing', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc, undefined, agency({ debt: '-20000' }))
    render(
      PaymentReceiptsPage,
      doc,
      allGoodsGrants,
      '/payment-receipts?new=1&agencyId=401&amount=1000',
    )
    await screen.findByText('Đại lý đang trả trước', { exact: false })
    fireEvent.click(button('Lưu nháp'))
    expect(await screen.findByText('Đại lý không còn nợ để thu.')).toBeDefined()
    expect(writes()).toHaveLength(0)
  })

  it('rejects a future business date before any write', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc)
    render(
      PaymentReceiptsPage,
      doc,
      allGoodsGrants,
      '/payment-receipts?new=1&agencyId=401&amount=1000',
    )
    await screen.findByRole('dialog', { name: 'Tạo phiếu thu tiền' })
    fireEvent.change(screen.getByLabelText('Ngày chứng từ'), {
      target: { value: '2026-11-15' },
    })
    fireEvent.click(button('Lưu nháp'))
    expect(
      await screen.findByText('Ngày chứng từ không được sau hôm nay.', {
        exact: false,
      }),
    ).toBeDefined()
    expect(writes()).toHaveLength(0)
  })

  it('saves and posts with the create ETag, keeping the draft when posting fails', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc, (path) =>
      path.endsWith('/post')
        ? new ApiError(409, 'PAYMENT_EXCEEDS_DEBT', 'Vượt công nợ')
        : response(doc, '"created-v1"'),
    )
    render(
      PaymentReceiptsPage,
      doc,
      allGoodsGrants,
      '/payment-receipts?new=1&agencyId=401&amount=1000',
    )
    await screen.findByRole('dialog', { name: 'Tạo phiếu thu tiền' })
    fireEvent.click(button('Lưu & ghi sổ'))
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()[1]![0]).toBe('/payment-receipts/1/post')
    expect(writes()[1]![1]?.ifMatch).toBe('"created-v1"')
    await screen.findByText('Đã lưu nháp PT-1 nhưng chưa ghi sổ được.')
    expect(
      await screen.findByText('Vượt công nợ', { exact: false }),
    ).toBeDefined()
  })

  it('edits a draft with PUT and If-Match, sending exact lines', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc)
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    fireEvent.click(button('Sửa nháp'))
    await screen.findByRole('dialog', { name: 'Sửa nháp PN-1' })
    fireEvent.click(button('Lưu nháp'))
    await waitFor(() => expect(writes()).toHaveLength(1))
    const [path, options] = writes()[0]!
    expect(path).toBe('/stock-receipts/1')
    expect(options).toMatchObject({
      method: 'PUT',
      ifMatch: '"parent-v1"',
      body: {
        businessDate: '2026-11-10',
        note: 'Original note',
        lines: [
          {
            productId: '301',
            quantity: '1.001',
            unitPrice: '900719925474099301',
          },
        ],
      },
    })
  })

  it('deletes a draft only after confirmation', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc)
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    fireEvent.click(button('Xóa nháp'))
    const confirm = await screen.findByRole('dialog', { name: 'Xóa nháp' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Quay lại' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(button('Xóa nháp'))
    const again = await screen.findByRole('dialog', { name: 'Xóa nháp' })
    fireEvent.click(within(again).getByRole('button', { name: 'Xóa nháp' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]![0]).toBe('/stock-receipts/1')
    expect(writes()[0]![1]).toMatchObject({
      method: 'DELETE',
      ifMatch: '"parent-v1"',
    })
    await screen.findByText('Đã xóa nháp PN-1.')
  })

  it('posts a draft with its ETag after confirmation', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc, () => response(posted('STOCK_RECEIPT'), '"v2"'))
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    fireEvent.click(button('Ghi sổ'))
    const confirm = await screen.findByRole('dialog', {
      name: 'Xác nhận ghi sổ',
    })
    expect(confirm.textContent).toContain('Tồn kho tăng')
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Xác nhận ghi sổ' }),
    )
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]![0]).toBe('/stock-receipts/1/post')
    expect(writes()[0]![1]).toMatchObject({
      method: 'POST',
      ifMatch: '"parent-v1"',
    })
    await screen.findByText('Đã ghi sổ PN-1.')
  })

  it('disables draft actions after a stale ETag (412)', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc, () => new ApiError(412, 'PRECONDITION_FAILED', 'Đã thay đổi'))
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    fireEvent.click(button('Ghi sổ'))
    const confirm = await screen.findByRole('dialog', {
      name: 'Xác nhận ghi sổ',
    })
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Xác nhận ghi sổ' }),
    )
    await screen.findByText('Đã thay đổi', { exact: false })
    expect((button('Ghi sổ') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Sửa nháp') as HTMLButtonElement).disabled).toBe(true)
  })

  it('warns in the post confirmation when an issue exceeds the debt limit', async () => {
    const doc = detail('STOCK_ISSUE', { totalAmount: '600000' })
    serve(doc)
    render(StockIssuesPage, doc)
    await openDetail('PX-1')
    fireEvent.click(button('Ghi sổ'))
    const confirm = await screen.findByRole('dialog', {
      name: 'Xác nhận ghi sổ',
    })
    expect(confirm.textContent).toContain('1.100.000 ₫')
    expect(confirm.textContent).toContain('Vượt nợ tối đa')
  })

  it('hides draft actions from a user without the kind grants', async () => {
    const doc = detail('STOCK_RECEIPT')
    serve(doc)
    render(StockReceiptsPage, doc, ['stock.issue.post', 'stock.receipt.post'])
    await openDetail('PN-1')
    expect(screen.queryByRole('button', { name: 'Sửa nháp' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Xóa nháp' })).toBeNull()
    expect(button('Ghi sổ')).toBeDefined()
  })
})

describe('document workbench: post & collect (A2)', () => {
  async function postAndCollect(after: DocumentDetail) {
    const doc = detail('STOCK_ISSUE', { totalAmount: '600000' })
    serve(doc, () => response(after, '"v2"'))
    render(StockIssuesPage, doc, allGoodsGrants, '/stock-issues')
    await openDetail('PX-1')
    fireEvent.click(button('Ghi sổ & lập phiếu thu'))
    const confirm = await screen.findByRole('dialog', {
      name: 'Xác nhận ghi sổ',
    })
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Ghi sổ & lập phiếu thu' }),
    )
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]![0]).toBe('/stock-issues/1/post')
  }

  it('posts then opens the receipt form prefilled with agency and amount', async () => {
    await postAndCollect(
      posted('STOCK_ISSUE', { totalAmount: '600000', agencyDebt: '1100000' }),
    )
    await waitFor(() =>
      expect(currentLocation()).toBe(
        '/payment-receipts?new=1&agencyId=401&amount=600000',
      ),
    )
  })

  it('caps the prefilled amount at the remaining debt', async () => {
    await postAndCollect(
      posted('STOCK_ISSUE', { totalAmount: '600000', agencyDebt: '250000' }),
    )
    await waitFor(() =>
      expect(currentLocation()).toBe(
        '/payment-receipts?new=1&agencyId=401&amount=250000',
      ),
    )
  })

  it('stays when the agency owes nothing after posting (prepaid)', async () => {
    await postAndCollect(
      posted('STOCK_ISSUE', { totalAmount: '600000', agencyDebt: '-1' }),
    )
    await screen.findByText(
      'Đã ghi sổ PX-1. Đại lý không còn nợ nên không cần lập phiếu thu.',
    )
    expect(currentLocation()).toBe('/stock-issues')
  })

  it('offers no shortcut without cash.receipt.prepare', async () => {
    const doc = detail('STOCK_ISSUE')
    serve(doc)
    render(StockIssuesPage, doc, ['stock.issue.prepare', 'stock.issue.post'])
    await openDetail('PX-1')
    expect(
      screen.queryByRole('button', { name: 'Ghi sổ & lập phiếu thu' }),
    ).toBeNull()
  })
})

describe('document workbench: cancel and correct', () => {
  it('cancels a posted document only with a reason, sending If-Match', async () => {
    const doc = posted('STOCK_RECEIPT')
    serve(doc, () =>
      response(posted('STOCK_RECEIPT', { status: 'CANCELLED' }), '"v3"'),
    )
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    fireEvent.click(button('Hủy'))
    const dialog = await screen.findByRole('dialog', { name: 'Hủy PN-1' })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận hủy' }),
    )
    expect(await screen.findByText('Vui lòng nhập lý do hủy.')).toBeDefined()
    expect(writes()).toHaveLength(0)
    fireEvent.change(
      within(dialog).getByLabelText('Lý do hủy', { exact: false }),
      {
        target: { value: '  Lập nhầm phiếu  ' },
      },
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận hủy' }),
    )
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]![0]).toBe('/stock-receipts/1/cancel')
    expect(writes()[0]![1]).toMatchObject({
      method: 'POST',
      body: { reason: 'Lập nhầm phiếu' },
      ifMatch: '"parent-v1"',
    })
    await screen.findByText('Đã hủy PN-1.')
  })

  it('keeps the dialog open with the server error on PERIOD_CLOSED', async () => {
    const doc = posted('STOCK_RECEIPT')
    serve(doc, () => new ApiError(409, 'PERIOD_CLOSED', 'Kỳ đã chốt'))
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    fireEvent.click(button('Hủy'))
    const dialog = await screen.findByRole('dialog', { name: 'Hủy PN-1' })
    fireEvent.change(
      within(dialog).getByLabelText('Lý do hủy', { exact: false }),
      {
        target: { value: 'Sai' },
      },
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Xác nhận hủy' }),
    )
    expect(
      await within(dialog).findByText('Kỳ đã chốt', { exact: false }),
    ).toBeDefined()
    expect(screen.getByRole('dialog', { name: 'Hủy PN-1' })).toBeDefined()
  })

  it('warns that cancelling a payment receipt may exceed the debt limit (QĐ7)', async () => {
    const doc = posted('PAYMENT_RECEIPT', {
      agencyDebt: '900000',
      totalAmount: '300000',
    })
    serve(doc)
    render(PaymentReceiptsPage, doc)
    await openDetail('PT-1')
    fireEvent.click(button('Hủy'))
    const dialog = await screen.findByRole('dialog', { name: 'Hủy PT-1' })
    expect(dialog.textContent).toContain('1.200.000 ₫')
    expect(dialog.textContent).toContain('vượt nợ tối đa 1.000.000 ₫')
  })

  it('locks cancel/correct for a document of a closed month', async () => {
    const doc = posted('STOCK_RECEIPT', { businessDate: '2026-10-31' })
    serve(doc)
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    const cancel = button('Hủy') as HTMLButtonElement
    expect(cancel.disabled).toBe(true)
    expect(
      cancel
        .closest('[data-locked-reason]')
        ?.getAttribute('data-locked-reason'),
    ).toContain('tháng hiện tại')
    expect((button('Sửa có lý do') as HTMLButtonElement).disabled).toBe(true)
  })

  it('hides cancel/correct without the grants, for drafts and for online receipts', async () => {
    const doc = posted('STOCK_RECEIPT')
    serve(doc)
    const view = render(StockReceiptsPage, doc, [
      'stock.receipt.prepare',
      'stock.receipt.post',
    ])
    await openDetail('PN-1')
    expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sửa có lý do' })).toBeNull()
    view.unmount()

    const online = posted('PAYMENT_RECEIPT', { receiptType: 'ONLINE' })
    serve(online)
    render(PaymentReceiptsPage, online)
    await openDetail('PT-1')
    expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sửa có lý do' })).toBeNull()
  })

  it('corrects with a reason: POST /corrections without agencyId, then opens the replacement', async () => {
    const doc = posted('STOCK_RECEIPT')
    const replacement = posted('STOCK_RECEIPT', {
      id: '2',
      code: 'PN-2',
      replaces: { id: '1', code: 'PN-1', status: 'CANCELLED' },
      replacesDocumentId: '1',
    })
    serve(doc, () => response(replacement, '"r1"'))
    render(StockReceiptsPage, doc)
    await openDetail('PN-1')
    fireEvent.click(button('Sửa có lý do'))
    const form = await screen.findByRole('dialog', {
      name: 'Sửa có lý do PN-1',
    })
    fireEvent.click(
      within(form).getByRole('button', {
        name: 'Hủy phiếu cũ & ghi sổ phiếu mới',
      }),
    )
    expect(
      await screen.findByText('Vui lòng nhập lý do sửa.', { exact: false }),
    ).toBeDefined()
    expect(writes()).toHaveLength(0)
    fireEvent.change(
      within(form).getByLabelText('Lý do sửa', { exact: false }),
      {
        target: { value: 'Sai số lượng' },
      },
    )
    fireEvent.click(
      within(form).getByRole('button', {
        name: 'Hủy phiếu cũ & ghi sổ phiếu mới',
      }),
    )
    await waitFor(() => expect(writes()).toHaveLength(1))
    const [path, options] = writes()[0]!
    expect(path).toBe('/stock-receipts/1/corrections')
    expect(options).toMatchObject({ method: 'POST', ifMatch: '"parent-v1"' })
    expect(options?.body).toMatchObject({ reason: 'Sai số lượng' })
    expect(options?.body).not.toHaveProperty('agencyId')
    await screen.findByText('Đã hủy PN-1 và lập PN-2 thay thế.')
    await waitFor(() =>
      expect(api.apiFetch).toHaveBeenCalledWith(
        '/stock-receipts/2',
        expect.anything(),
      ),
    )
  })

  it('lets a payment correction collect up to debt plus the cancelled amount', async () => {
    const doc = posted('PAYMENT_RECEIPT', { totalAmount: '300000' })
    serve(doc, undefined, agency({ debt: '200000' }))
    render(PaymentReceiptsPage, doc)
    await openDetail('PT-1')
    fireEvent.click(button('Sửa có lý do'))
    const form = await screen.findByRole('dialog', {
      name: 'Sửa có lý do PT-1',
    })
    await within(form).findByText('Thu toàn bộ nợ 500.000 ₫')
    fireEvent.change(
      within(form).getByLabelText('Số tiền thu (VNĐ)', { exact: false }),
      {
        target: { value: '500001' },
      },
    )
    fireEvent.change(
      within(form).getByLabelText('Lý do sửa', { exact: false }),
      {
        target: { value: 'Sai số tiền' },
      },
    )
    const submit = within(form).getByRole('button', {
      name: 'Hủy phiếu cũ & ghi sổ phiếu mới',
    })
    fireEvent.click(submit)
    expect(
      await within(form).findByText(
        'Số tiền thu không được vượt nợ hiện tại (500.000 ₫).',
      ),
    ).toBeDefined()
    expect(writes()).toHaveLength(0)
    fireEvent.change(
      within(form).getByLabelText('Số tiền thu (VNĐ)', { exact: false }),
      {
        target: { value: '450000' },
      },
    )
    fireEvent.click(submit)
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]![1]?.body).toEqual({
      businessDate: '2026-11-10',
      note: 'Original note',
      reason: 'Sai số tiền',
      receiptType: 'CASH',
      amount: '450000',
    })
  })
})
