import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDetail } from '../features/document_history/documentContracts'
import { PaymentReceiptsPage } from '../features/payment_receipts/PaymentReceiptsPage'
import { PdfButton } from '../features/payment_receipts/PdfButton'
import { TransferHandoff } from '../features/payment_receipts/TransferHandoff'
import { DocumentFormModal } from '../features/stock_receipts/DocumentFormModal'
import { emptyForm } from '../features/document_history/documentContracts'
import * as api from '../lib/api'
import { ApiError, type RequestOptions } from '../lib/api'
import * as cache from '../lib/cache'
import type { FunctionCode } from '../lib/types'
import {
  agency,
  allGoodsGrants,
  detail,
  page,
  posted,
  renderGoods,
  response,
  summary,
  useToday,
} from './goodsFixtures'

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

const transferGrants: FunctionCode[] = [...allGoodsGrants, 'payments.online']
const CHECKOUT =
  'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=VNPabc'

function onlinePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: '37',
    agencyId: '401',
    agencyCode: 'DL-401',
    agencyName: 'Đại lý An Phát',
    provider: 'VNPAY',
    merchantReference: 'VNP' + 'a'.repeat(32),
    providerTransactionId: null,
    amount: '200000',
    status: 'PENDING',
    expiresAt: '2026-11-14T10:30:00Z',
    paymentTime: null,
    receiptDocumentId: null,
    receiptCode: null,
    createdBy: '1',
    createdAt: '2026-11-14T10:00:00Z',
    updatedAt: '2026-11-14T10:00:00Z',
    checkoutUrl: CHECKOUT,
    ...overrides,
  }
}

type Handler = (path: string, options: RequestOptions) => unknown

function serve(doc: DocumentDetail, write?: Handler) {
  vi.mocked(api.apiFetch).mockImplementation(async (path, options = {}) => {
    const method = options.method ?? 'GET'
    if (method === 'GET') {
      if (path.startsWith('/agencies/')) return response(agency())
      if (path.startsWith('/agencies?')) return response(page([agency()]))
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
function renderPage(
  doc: DocumentDetail,
  grants: FunctionCode[] = transferGrants,
  url = '/payment-receipts',
) {
  vi.mocked(cache.cachedApiFetch).mockResolvedValue(
    response(page([summary(doc)])) as never,
  )
  return renderGoods(<PaymentReceiptsPage />, grants, url)
}
function methodSelect() {
  // The list behind the form has its own "Hình thức thu" filter.
  const dialog = screen.queryByRole('dialog', { name: 'Tạo phiếu thu tiền' })
  return (dialog ? within(dialog) : screen).getByRole('combobox', {
    name: 'Hình thức thu',
  }) as HTMLSelectElement
}
function optionValues(select: HTMLSelectElement) {
  return [...select.options].map((option) => option.value).filter(Boolean)
}
function pdfBlob() {
  return {
    data: new Blob(['%PDF'], { type: 'application/pdf' }),
    status: 200,
    etag: null,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  useToday()
  vi.spyOn(cache, 'invalidateCache').mockImplementation(() => {})
  vi.spyOn(cache, 'cachedApiFetch')
  vi.spyOn(api, 'apiFetch')
  vi.spyOn(api, 'apiDownload')
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:pdf'),
    revokeObjectURL: vi.fn(),
  })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('PdfButton', () => {
  it('downloads the PDF of the print endpoint under the given name', async () => {
    vi.mocked(api.apiDownload).mockResolvedValueOnce(pdfBlob())
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    renderGoods(<PdfButton path="/documents/9/print" filename="PT-9.pdf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(api.apiDownload).toHaveBeenCalledWith(
      '/documents/9/print',
      expect.objectContaining({ headers: { Accept: 'application/pdf' } }),
    )
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('PT-9.pdf')
    expect(anchor.href).toBe('blob:pdf')
  })

  it('reports a failed export as an error toast and can retry', async () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => 1)
    vi.mocked(api.apiDownload)
      .mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Không có quyền'))
      .mockResolvedValueOnce(pdfBlob())
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderGoods(
      <PdfButton path="/online-payments/37/print" filename="a.pdf">
        PDF
      </PdfButton>,
    )
    const button = screen.getByRole('button', { name: 'PDF' })
    fireEvent.click(button)
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    expect(error.mock.calls[0]![0]).toBe('Không xuất được PDF.')
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(api.apiDownload).toHaveBeenCalledTimes(2))
    expect(error).toHaveBeenCalledTimes(1)
  })
})

describe('payment receipt form: transfer channel', () => {
  function renderForm(
    props: Partial<Parameters<typeof DocumentFormModal>[0]> = {},
  ) {
    const onSubmit = vi.fn()
    const onTransfer = vi.fn()
    renderGoods(
      <DocumentFormModal
        kind="PAYMENT_RECEIPT"
        mode="create"
        initial={{ ...emptyForm(), amount: '150000' }}
        busy={false}
        error={null}
        canPostNow
        canTransfer
        onSubmit={onSubmit}
        onTransfer={onTransfer}
        onClose={() => {}}
        {...props}
      />,
    )
    return { onSubmit, onTransfer }
  }

  it('offers cash or a VNPAY transfer and routes the transfer to onTransfer', () => {
    const { onSubmit, onTransfer } = renderForm()
    expect(optionValues(methodSelect())).toEqual(['CASH', 'VNPAY'])
    expect(screen.getByRole('button', { name: 'Lưu & ghi sổ' })).toBeDefined()
    fireEvent.change(methodSelect(), { target: { value: 'VNPAY' } })
    expect(screen.getByText('Thu qua chuyển khoản VNPAY')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lưu & ghi sổ' })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Tạo thanh toán & mã QR' }),
    )
    expect(onTransfer).toHaveBeenCalledTimes(1)
    expect(onTransfer.mock.calls[0]![0]).toMatchObject({ amount: '150000' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('switching back to cash restores the document buttons', () => {
    const { onSubmit, onTransfer } = renderForm()
    fireEvent.change(methodSelect(), { target: { value: 'VNPAY' } })
    fireEvent.change(methodSelect(), { target: { value: 'CASH' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ receiptType: 'CASH' }),
      false,
    )
    expect(onTransfer).not.toHaveBeenCalled()
  })

  it('without payments.online offers cash only and explains why', () => {
    renderForm({ canTransfer: false })
    expect(optionValues(methodSelect())).toEqual(['CASH'])
    expect(
      screen.getByText(
        'Thu chuyển khoản cần quyền Thanh toán trực tuyến để tạo mã QR VNPAY.',
      ),
    ).toBeDefined()
  })

  it('keeps manual types when editing an existing draft', () => {
    renderForm({
      mode: 'edit',
      doc: detail('PAYMENT_RECEIPT', { receiptType: 'BANK_TRANSFER' }),
      initial: { ...emptyForm(), receiptType: 'BANK_TRANSFER', amount: '1' },
    })
    expect(optionValues(methodSelect())).toEqual(['CASH', 'BANK_TRANSFER'])
    expect(methodSelect().value).toBe('BANK_TRANSFER')
  })
})

describe('payment receipt workbench: transfer and PDF', () => {
  it('creates a pending VNPAY payment instead of a receipt and shows the QR handoff', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc, (path) =>
      path === '/online-payments'
        ? { data: onlinePayment(), etag: null, status: 201 }
        : response(doc),
    )
    renderPage(
      doc,
      transferGrants,
      '/payment-receipts?new=1&agencyId=401&amount=200000',
    )
    await screen.findByRole('dialog', { name: 'Tạo phiếu thu tiền' })
    await screen.findByText('Thu toàn bộ nợ 500.000 ₫')
    fireEvent.change(methodSelect(), { target: { value: 'VNPAY' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tạo thanh toán & mã QR' }),
    )
    const handoff = await screen.findByRole('dialog', {
      name: 'Thanh toán chuyển khoản',
    })
    expect(writes()).toHaveLength(1)
    const [path, options] = writes()[0]!
    expect(path).toBe('/online-payments')
    expect(options).toMatchObject({
      method: 'POST',
      body: { agencyId: '401', provider: 'VNPAY', amount: '200000' },
    })
    expect(options?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(within(handoff).getByText('200.000 ₫')).toBeDefined()
    expect(within(handoff).getByText('DL-401 · Đại lý An Phát')).toBeDefined()
    expect(
      within(handoff).getByTitle('Mã QR trang thanh toán VNPAY'),
    ).toBeDefined()
    expect(
      within(handoff).getByRole('link', { name: 'Mở trang thanh toán' }),
    ).toBeDefined()
    // No receipt write: the receipt appears only when VNPAY confirms.
    expect(writes().some(([p]) => p.startsWith('/payment-receipts'))).toBe(
      false,
    )
    vi.mocked(api.apiDownload).mockResolvedValueOnce(pdfBlob())
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(
      within(handoff).getByRole('button', {
        name: 'Tải PDF phiếu báo thanh toán',
      }),
    )
    await waitFor(() =>
      expect(api.apiDownload).toHaveBeenCalledWith(
        '/online-payments/37/print',
        expect.objectContaining({ headers: { Accept: 'application/pdf' } }),
      ),
    )
  })

  it('keeps the form open with the server error when the payment is refused', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(
      doc,
      () => new ApiError(409, 'PAYMENT_EXCEEDS_DEBT', 'Số tiền vượt công nợ'),
    )
    renderPage(
      doc,
      transferGrants,
      '/payment-receipts?new=1&agencyId=401&amount=200000',
    )
    await screen.findByText('Thu toàn bộ nợ 500.000 ₫')
    fireEvent.change(methodSelect(), { target: { value: 'VNPAY' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tạo thanh toán & mã QR' }),
    )
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(
      screen.getByRole('dialog', { name: 'Tạo phiếu thu tiền' }),
    ).toBeDefined()
    expect(
      screen.queryByRole('dialog', { name: 'Thanh toán chuyển khoản' }),
    ).toBeNull()
  })

  it('blocks a transfer above the current debt before calling the server', async () => {
    const doc = detail('PAYMENT_RECEIPT')
    serve(doc)
    renderPage(
      doc,
      transferGrants,
      '/payment-receipts?new=1&agencyId=401&amount=600000',
    )
    await screen.findByText('Thu toàn bộ nợ 500.000 ₫')
    fireEvent.change(methodSelect(), { target: { value: 'VNPAY' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Tạo thanh toán & mã QR' }),
    )
    expect(
      await screen.findByText(
        'Số tiền thu không được vượt nợ hiện tại (500.000 ₫).',
      ),
    ).toBeDefined()
    expect(writes()).toHaveLength(0)
  })

  it.each([
    ['cash', posted('PAYMENT_RECEIPT', { id: '12', code: 'PT-12' })],
    [
      'online',
      posted('PAYMENT_RECEIPT', {
        id: '13',
        code: 'PT-13',
        receiptType: 'ONLINE',
      }),
    ],
  ])('exports the PDF of a %s receipt from its detail', async (_, doc) => {
    serve(doc)
    vi.mocked(api.apiDownload).mockResolvedValueOnce(pdfBlob())
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    renderPage(doc, allGoodsGrants)
    fireEvent.click(
      await screen.findByRole('button', { name: `Chi tiết ${doc.code}` }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: `Chi tiết ${doc.code}`,
    })
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Xuất PDF phiếu thu' }),
    )
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(api.apiDownload).toHaveBeenCalledWith(
      `/documents/${doc.id}/print`,
      expect.objectContaining({ headers: { Accept: 'application/pdf' } }),
    )
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      `${doc.code}.pdf`,
    )
  })
})

describe('TransferHandoff', () => {
  it('hides the QR when the payment has no usable link and links to Online payments', () => {
    renderGoods(
      <TransferHandoff
        payment={onlinePayment({ checkoutUrl: 'http://insecure.test/pay' })}
        onClose={() => {}}
      />,
      transferGrants,
    )
    expect(screen.getByText('Chưa có liên kết')).toBeDefined()
    expect(screen.queryByTitle('Mã QR trang thanh toán VNPAY')).toBeNull()
    const link = screen.getByRole('link', {
      name: 'Xem trong Thanh toán trực tuyến',
    })
    expect(link.getAttribute('href')).toBe('/online-payments?paymentId=37')
  })

  it('omits the Online payments link when the user cannot open it', () => {
    renderGoods(
      <TransferHandoff payment={onlinePayment()} onClose={() => {}} />,
      ['cash.receipt.prepare'],
    )
    expect(
      screen.queryByRole('link', { name: 'Xem trong Thanh toán trực tuyến' }),
    ).toBeNull()
    expect(screen.getByTitle('Mã QR trang thanh toán VNPAY')).toBeDefined()
  })
})
