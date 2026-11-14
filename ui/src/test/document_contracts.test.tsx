import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DebtPanel } from '../features/document_history/DebtPanel'
import {
  canChange,
  canReadKind,
  changeBlock,
  compareMoney,
  documentBody,
  documentLink,
  emptyForm,
  formFromDocument,
  inputLines,
  parseChain,
  parseDocument,
  parsePage,
  parseSummary,
  receiptAmountAfterIssue,
  receiptFormLink,
  type DocumentForm,
} from '../features/document_history/documentContracts'
import {
  lifecycleSteps,
  replacementSuffix,
} from '../features/document_history/insightsModel'
import {
  parseAgencyBalance,
  parseProductQuote,
} from '../features/document_history/useRecords'
import {
  cancelEffect,
  documentNext,
  documentNotice,
  documentSteps,
  postEffect,
} from '../features/document_history/workflow'
import type { FunctionCode } from '../lib/types'
import {
  agency,
  chainItem,
  detail,
  line,
  page,
  posted,
  product,
  summary,
  TODAY,
} from './goodsFixtures'

const has =
  (...grants: FunctionCode[]) =>
  (permission: FunctionCode | FunctionCode[]) =>
    Array.isArray(permission)
      ? permission.some((grant) => grants.includes(grant))
      : grants.includes(permission)

function form(overrides: Partial<DocumentForm> = {}): DocumentForm {
  return {
    ...emptyForm(TODAY),
    agencyId: '401',
    lines: [{ productId: '301', quantity: '2', unitPrice: '1500' }],
    ...overrides,
  }
}

describe('document contract parsers', () => {
  it('parses each kind of summary and enforces the agency rule', () => {
    for (const kind of [
      'STOCK_RECEIPT',
      'STOCK_ISSUE',
      'PAYMENT_RECEIPT',
    ] as const)
      expect(parseSummary(summary(detail(kind))).kind).toBe(kind)
    expect(() =>
      parseSummary({ ...summary(detail('STOCK_RECEIPT')), agencyId: '401' }),
    ).toThrow()
    expect(() =>
      parseSummary({ ...summary(detail('STOCK_ISSUE')), agencyId: null }),
    ).toThrow()
  })

  it.each([
    ['code', 'TH-1'],
    ['code', 'PN-0'],
    ['kind', 'SALES_RETURN'],
    ['status', 'PENDING'],
    ['businessDate', '2026-02-30'],
    ['totalAmount', '-1'],
    ['totalAmount', '1.5'],
    ['receiptType', 'CHEQUE'],
    ['lineCount', -1],
    ['id', '9223372036854775808'],
  ])('rejects a summary with an invalid %s (%s)', (field, value) => {
    expect(() =>
      parseSummary({ ...summary(detail('STOCK_RECEIPT')), [field]: value }),
    ).toThrow()
  })

  it('accepts the largest id and zero totals at the boundary', () => {
    const row = parseSummary({
      ...summary(detail('STOCK_RECEIPT')),
      id: '9223372036854775807',
      totalAmount: '0',
      lineCount: 0,
    })
    expect(row.id).toBe('9223372036854775807')
  })

  it('parses a detail with signed debt, references and lines', () => {
    const doc = parseDocument(
      posted('STOCK_ISSUE', {
        agencyDebt: '-25000',
        replaces: { id: '7', code: 'PX-7', status: 'CANCELLED' },
      }),
    )
    expect(doc.agencyDebt).toBe('-25000')
    expect(doc.replaces?.code).toBe('PX-7')
    expect(doc.lines[0]?.quantity).toBe('1.001')
    expect(parseDocument({ ...detail(), replaces: undefined }).replaces).toBe(
      null,
    )
  })

  it.each([
    { lines: null },
    { agencyMaxDebt: '-1' },
    { agencyDebt: '1.5' },
    { sellingPriceRate: '0' },
    { replaces: { id: 'x', code: 'PN-1', status: 'POSTED' } },
    { lines: [line({ quantity: '0.000' })] },
    { lines: [line({ unitPrice: '-1' })] },
  ])('rejects a malformed detail %j', (overrides) => {
    expect(() => parseDocument({ ...detail(), ...overrides })).toThrow()
  })

  it('parses a replacement chain and pages', () => {
    const items = parseChain({
      items: [
        chainItem(
          posted('STOCK_RECEIPT', { status: 'CANCELLED', cancelReason: 'Sai' }),
        ),
        chainItem(posted('STOCK_RECEIPT', { id: '2', code: 'PN-2' })),
      ],
    })
    expect(items.map((item) => item.cancelReason)).toEqual(['Sai', null])
    expect(parseChain({ items: [] })).toEqual([])
    expect(() => parseChain({})).toThrow()
    expect(() =>
      parseChain({ items: [{ ...chainItem(), cancelReason: 1 }] }),
    ).toThrow()
    expect(parsePage(page([summary()]), parseSummary).items).toHaveLength(1)
    expect(() =>
      parsePage(
        {
          items: [],
          pagination: { limit: 25, hasMore: true, nextCursor: null },
        },
        parseSummary,
      ),
    ).toThrow()
    expect(() =>
      parsePage(
        {
          items: [],
          pagination: { limit: 101, hasMore: false, nextCursor: null },
        },
        parseSummary,
      ),
    ).toThrow()
  })

  it('parses agency balances and product quotes for estimates', () => {
    expect(parseAgencyBalance(agency({ debt: '-1' })).debt).toBe('-1')
    expect(() => parseAgencyBalance(agency({ debt: '1.5' }))).toThrow()
    expect(() => parseAgencyBalance(agency({ maxDebt: '-1' }))).toThrow()
    expect(() => parseAgencyBalance(agency({ id: '0' }))).toThrow()
    expect(
      parseProductQuote(product({ sellingPrice: null })).sellingPrice,
    ).toBe(null)
    expect(parseProductQuote(product({ code: undefined })).code).toBe('')
    expect(() => parseProductQuote(product({ stock: '-1' }))).toThrow()
    expect(() => parseProductQuote(product({ sellingPrice: '1.5' }))).toThrow()
  })
})

describe('document change rules', () => {
  it('allows cancel/correct only for posted, non-online documents of this month', () => {
    expect(changeBlock(posted('STOCK_RECEIPT'), TODAY)).toBeNull()
    expect(
      changeBlock(
        posted('STOCK_RECEIPT', { businessDate: '2026-11-01' }),
        TODAY,
      ),
    ).toBeNull()
    expect(changeBlock(detail('STOCK_RECEIPT'), TODAY)).toContain('đã ghi sổ')
    expect(
      changeBlock(posted('STOCK_RECEIPT', { status: 'CANCELLED' }), TODAY),
    ).toContain('đã ghi sổ')
    expect(
      changeBlock(posted('PAYMENT_RECEIPT', { receiptType: 'ONLINE' }), TODAY),
    ).toContain('trực tuyến')
    expect(
      changeBlock(
        posted('STOCK_RECEIPT', { businessDate: '2026-10-31' }),
        TODAY,
      ),
    ).toContain('tháng hiện tại')
  })

  it('requires documents.cancel to cancel and correct + post grants to correct', () => {
    const doc = posted('STOCK_ISSUE')
    expect(canChange(doc, 'cancel', has('documents.cancel'), TODAY)).toBe(true)
    expect(canChange(doc, 'cancel', has('stock.issue.post'), TODAY)).toBe(false)
    expect(
      canChange(
        doc,
        'correct',
        has('documents.correct', 'stock.issue.post'),
        TODAY,
      ),
    ).toBe(true)
    expect(canChange(doc, 'correct', has('documents.correct'), TODAY)).toBe(
      false,
    )
    expect(
      canChange(
        detail('STOCK_ISSUE'),
        'cancel',
        has('documents.cancel'),
        TODAY,
      ),
    ).toBe(false)
  })

  it('reads a kind with any of its grants', () => {
    expect(canReadKind('STOCK_ISSUE', has('stock.issue.prepare'))).toBe(true)
    expect(canReadKind('STOCK_ISSUE', has('stock.receipt.post'))).toBe(false)
  })
})

describe('document request bodies', () => {
  it('builds receipt, issue and payment draft bodies', () => {
    expect(documentBody('STOCK_RECEIPT', form(), 'draft', TODAY)).toEqual({
      businessDate: TODAY,
      note: null,
      lines: [{ productId: '301', quantity: '2', unitPrice: '1500' }],
    })
    expect(
      documentBody('STOCK_ISSUE', form({ note: ' Giao gấp ' }), 'draft', TODAY),
    ).toEqual({
      businessDate: TODAY,
      note: 'Giao gấp',
      agencyId: '401',
      lines: [{ productId: '301', quantity: '2' }],
    })
    expect(
      documentBody(
        'PAYMENT_RECEIPT',
        form({ receiptType: 'BANK_TRANSFER', amount: ' 1000 ' }),
        'draft',
        TODAY,
      ),
    ).toEqual({
      businessDate: TODAY,
      note: null,
      agencyId: '401',
      receiptType: 'BANK_TRANSFER',
      amount: '1000',
    })
  })

  it('builds a correction body with a reason and without agencyId', () => {
    const body = documentBody(
      'STOCK_ISSUE',
      form({ reason: ' Sai ' }),
      'correct',
      TODAY,
    )
    expect(body).toEqual({
      businessDate: TODAY,
      note: null,
      reason: 'Sai',
      lines: [{ productId: '301', quantity: '2' }],
    })
  })

  it.each([
    ['a future date', form({ businessDate: '2026-11-15' }), 'draft'],
    ['an invalid date', form({ businessDate: '2026-02-30' }), 'draft'],
    ['a missing agency', form({ agencyId: '' }), 'draft'],
    ['a correction without reason', form({ reason: '  ' }), 'correct'],
    [
      'a correction dated in a closed month',
      form({ reason: 'x', businessDate: '2026-10-31' }),
      'correct',
    ],
  ] as const)('rejects %s', (_, values, mode) => {
    expect(() => documentBody('STOCK_ISSUE', values, mode, TODAY)).toThrow()
  })

  it.each([
    ['0', 'too small'],
    ['1000000000000000000', 'too long'],
    ['1.5', 'decimal'],
    ['', 'empty'],
  ])('rejects a payment amount of %s (%s)', (amount) => {
    expect(() =>
      documentBody('PAYMENT_RECEIPT', form({ amount }), 'draft', TODAY),
    ).toThrow()
  })

  it('accepts the 18-digit payment boundary and the first day of the month', () => {
    expect(
      documentBody(
        'PAYMENT_RECEIPT',
        form({
          amount: '999999999999999999',
          businessDate: '2026-11-01',
          reason: 'Sai',
        }),
        'correct',
        TODAY,
      ),
    ).toMatchObject({ amount: '999999999999999999', reason: 'Sai' })
  })

  it('validates lines: products, duplicates, quantities and receipt prices', () => {
    expect(() => inputLines('STOCK_RECEIPT', [])).toThrow()
    expect(() =>
      inputLines('STOCK_ISSUE', [
        { productId: '', quantity: '1', unitPrice: '' },
      ]),
    ).toThrow()
    expect(() =>
      inputLines('STOCK_ISSUE', [
        { productId: '1', quantity: '1', unitPrice: '' },
        { productId: '1', quantity: '2', unitPrice: '' },
      ]),
    ).toThrow('Mỗi mặt hàng chỉ được một dòng')
    for (const quantity of ['0', '0.000', '1.0001', '-1', 'x'])
      expect(() =>
        inputLines('STOCK_ISSUE', [
          { productId: '1', quantity, unitPrice: '' },
        ]),
      ).toThrow()
    expect(() =>
      inputLines('STOCK_RECEIPT', [
        { productId: '1', quantity: '1', unitPrice: '0' },
      ]),
    ).toThrow()
    expect(
      inputLines('STOCK_ISSUE', [
        { productId: '1', quantity: ' 0.001 ', unitPrice: '9' },
      ]),
    ).toEqual([{ productId: '1', quantity: '0.001' }])
  })

  it('prefills edit/correct forms from a document', () => {
    expect(formFromDocument(detail('STOCK_RECEIPT')).lines).toEqual([
      { productId: '301', quantity: '1.001', unitPrice: '900719925474099301' },
    ])
    expect(formFromDocument(detail('STOCK_ISSUE')).lines[0]?.unitPrice).toBe('')
    const payment = formFromDocument(
      detail('PAYMENT_RECEIPT', { receiptType: 'BANK_TRANSFER', note: null }),
    )
    expect(payment).toMatchObject({
      amount: '300000',
      receiptType: 'BANK_TRANSFER',
      note: '',
      agencyId: '401',
      reason: '',
    })
    expect(payment.lines).toHaveLength(1)
  })
})

describe('money helpers and links', () => {
  it('compares signed money exactly', () => {
    expect(compareMoney('900719925474099302', '900719925474099301')).toBe(1)
    expect(compareMoney('-1', '0')).toBe(-1)
    expect(compareMoney('5', '5')).toBe(0)
  })
  it('prefills the receipt amount from the issue total capped at the debt', () => {
    expect(receiptAmountAfterIssue('600000', '1100000')).toBe('600000')
    expect(receiptAmountAfterIssue('600000', '250000')).toBe('250000')
    expect(receiptAmountAfterIssue('600000', '600000')).toBe('600000')
    expect(receiptAmountAfterIssue('600000', null)).toBe('600000')
    expect(receiptAmountAfterIssue('600000', '0')).toBeNull()
    expect(receiptAmountAfterIssue('600000', '-5')).toBeNull()
    expect(receiptAmountAfterIssue('0', '100')).toBeNull()
  })
  it('builds deep links to a document and to the prefilled receipt form', () => {
    expect(documentLink('PAYMENT_RECEIPT', '12')).toBe(
      '/payment-receipts?document=12',
    )
    expect(receiptFormLink('401', '600000')).toBe(
      '/payment-receipts?new=1&agencyId=401&amount=600000',
    )
    expect(receiptFormLink('401', null)).toBe(
      '/payment-receipts?new=1&agencyId=401',
    )
  })
})

describe('document workflow model', () => {
  const grants = { prepare: true, post: true, collect: true }
  it('describes draft, posted and cancelled issue steps', () => {
    expect(
      documentSteps(detail('STOCK_ISSUE'), grants).map((step) => step.state),
    ).toEqual(['current', 'todo', 'todo'])
    expect(
      documentSteps(detail('STOCK_ISSUE'), { ...grants, post: false })[1]
        ?.state,
    ).toBe('blocked')
    expect(
      documentSteps(posted('STOCK_ISSUE'), grants).map((step) => step.state),
    ).toEqual(['done', 'done', 'current'])
    const cancelled = documentSteps(
      posted('STOCK_RECEIPT', { status: 'CANCELLED' }),
      grants,
    )
    expect(cancelled.map((step) => step.key)).toEqual([
      'draft',
      'post',
      'cancelled',
    ])
  })
  it('suggests the next action from state and grants', () => {
    expect(documentNext(detail('STOCK_RECEIPT'), grants)?.title).toBe(
      'Kiểm tra rồi ghi sổ',
    )
    expect(
      documentNext(detail('STOCK_ISSUE'), { ...grants, post: false })
        ?.waitingFor,
    ).toBe('Kho')
    const collect = documentNext(
      posted('STOCK_ISSUE', { totalAmount: '600000', agencyDebt: '700000' }),
      grants,
    )
    expect(collect?.to).toBe(
      '/payment-receipts?new=1&agencyId=401&amount=600000',
    )
    expect(
      documentNext(posted('STOCK_ISSUE'), { ...grants, collect: false })
        ?.waitingFor,
    ).toBe('Kế toán')
    expect(
      documentNext(posted('STOCK_ISSUE', { agencyDebt: '0' }), grants),
    ).toBeNull()
    expect(documentNext(posted('STOCK_RECEIPT'), grants)).toBeNull()
  })
  it('explains effects and notices for every action', () => {
    expect(postEffect('PAYMENT_RECEIPT')).toContain('giảm')
    expect(cancelEffect('PAYMENT_RECEIPT')).toContain('vượt nợ tối đa')
    expect(documentNotice('post', 'STOCK_ISSUE', 'PX-1').next).toContain(
      'Lập phiếu thu',
    )
    expect(documentNotice('delete', 'STOCK_ISSUE', 'PX-1')).toEqual({
      done: 'Đã xóa nháp PX-1.',
    })
    expect(documentNotice('correct', 'STOCK_RECEIPT', 'PN-2').done).toBe(
      'Đã lập PN-2 thay thế.',
    )
  })
  it('labels lifecycle steps and replacement badges', () => {
    expect(lifecycleSteps('DRAFT').current).toBe(0)
    expect(lifecycleSteps('POSTED').current).toBe(1)
    const cancelled = lifecycleSteps('CANCELLED')
    expect(cancelled.current).toBe(2)
    expect(cancelled.steps).toHaveLength(3)
    expect(replacementSuffix(summary(detail()))).toBeUndefined()
    expect(
      replacementSuffix({ ...summary(detail()), replacedByDocumentId: '2' }),
    ).toBe('đã thay thế')
    expect(
      replacementSuffix({ ...summary(detail()), replacesDocumentId: '1' }),
    ).toBe('phiếu thay thế')
  })
})

describe('DebtPanel', () => {
  function panel() {
    return screen.getByLabelText('Công nợ đại lý').textContent ?? ''
  }
  it('shows current, maximum and after-document debt', () => {
    render(<DebtPanel debt="500000" maxDebt="1000000" change={200000n} />)
    expect(panel()).toContain('500.000 ₫')
    expect(panel()).toContain('1.000.000 ₫')
    expect(panel()).toContain('700.000 ₫')
    expect(panel()).not.toContain('Vượt nợ tối đa')
  })
  it('warns when an issue would exceed the limit, but not at the limit', () => {
    const { rerender } = render(
      <DebtPanel debt="500000" maxDebt="1000000" change={500001n} />,
    )
    expect(panel()).toContain('Vượt nợ tối đa')
    rerender(<DebtPanel debt="500000" maxDebt="1000000" change={500000n} />)
    expect(panel()).not.toContain('Vượt nợ tối đa')
  })
  it('flags a payment above the debt and a prepaid balance', () => {
    const { rerender } = render(
      <DebtPanel debt="100" maxDebt="1000" change={-101n} />,
    )
    expect(screen.getByRole('alert').textContent).toBe(
      'Số tiền thu vượt nợ hiện tại.',
    )
    rerender(<DebtPanel debt="-500" maxDebt="1000" />)
    expect(panel()).toContain('Đại lý đang trả trước')
  })
})
