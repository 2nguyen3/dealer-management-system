import { describe, expect, it } from 'vitest'
import {
  lineAmount,
  quantitySign,
  scaledQuantity,
  sumAmounts,
} from '../features/document_history/lineMath'
import {
  debtAfter,
  estimateLine,
  estimatePrice,
  issueLineWarning,
  paymentLimit,
  summarizeLines,
} from '../features/stock_receipts/lineEstimates'
import type { ProductQuote } from '../features/document_history/useRecords'

const line = (quantity: string, unitPrice = '') => ({
  productId: '1',
  quantity,
  unitPrice,
})

describe('exact document line arithmetic', () => {
  it('scales valid quantities to thousandths and rejects malformed input', () => {
    expect(scaledQuantity('1')).toBe(1000n)
    expect(scaledQuantity('1.5')).toBe(1500n)
    expect(scaledQuantity('-0.001')).toBe(-1n)
    expect(scaledQuantity(' 2.25 ')).toBe(2250n)
    for (const bad of ['', '1e3', '1.0001', '01', '-', '.5', 'abc'])
      expect(scaledQuantity(bad)).toBeNull()
  })
  it('multiplies 18-digit prices exactly and rounds half away from zero', () => {
    expect(lineAmount('999999999999999.999', '900719925474099301')).toBe(
      900719925474099300099280074525901n,
    )
    expect(lineAmount('2.5', '1001')).toBe(2503n)
    expect(lineAmount('-2.5', '1001')).toBe(-2503n)
    expect(lineAmount('0.001', '499')).toBe(0n)
    expect(lineAmount('0.001', '500')).toBe(1n)
    expect(lineAmount('1', '0')).toBe(0n)
    expect(lineAmount('1', '-5')).toBeNull()
    expect(lineAmount('1', '1.5')).toBeNull()
    expect(lineAmount('x', '5')).toBeNull()
  })
  it('sums amounts skipping unknown values and reports signs', () => {
    expect(sumAmounts([1n, null, 2n])).toBe(3n)
    expect(sumAmounts([])).toBe(0n)
    expect(quantitySign('3')).toBe(1)
    expect(quantitySign('-0.5')).toBe(-1)
    expect(quantitySign('-0.000')).toBe(0)
    expect(quantitySign('bad')).toBeNull()
  })
})

const quote = (overrides: Partial<ProductQuote> = {}): ProductQuote => ({
  id: '1',
  code: 'SP-1',
  name: 'Bút',
  unitName: 'Cây',
  stock: '10',
  lastPurchasePrice: '1000',
  sellingPrice: '1020',
  ...overrides,
})

describe('goods editor estimates', () => {
  it('estimates receipts from the entered price and issues from the quote', () => {
    expect(estimatePrice('STOCK_RECEIPT', line('2', ' 150 '))).toBe('150')
    expect(estimatePrice('STOCK_RECEIPT', line('2', ''))).toBeNull()
    expect(estimatePrice('STOCK_ISSUE', line('2'), { '1': quote() })).toBe(
      '1020',
    )
    expect(estimatePrice('STOCK_ISSUE', line('2'))).toBeNull()
    expect(
      estimatePrice('STOCK_ISSUE', line('2'), {
        '1': quote({ sellingPrice: null }),
      }),
    ).toBeNull()
    expect(estimateLine('STOCK_RECEIPT', line('2', '150'))).toBe(300n)
    expect(estimateLine('STOCK_ISSUE', line('1.5'), { '1': quote() })).toBe(
      1530n,
    )
    expect(estimateLine('STOCK_ISSUE', line('1', '100'))).toBeNull()
  })
  it('summarizes counts, priced lines and the exact subtotal', () => {
    expect(
      summarizeLines('STOCK_RECEIPT', [line('2', '150'), line('', '1')]),
    ).toEqual({ lineCount: 2, pricedLines: 1, subtotal: 300n })
    expect(summarizeLines('STOCK_ISSUE', [])).toEqual({
      lineCount: 0,
      pricedLines: 0,
      subtotal: 0n,
    })
  })
  it('computes debt after a change exactly, including negative debt', () => {
    expect(debtAfter('500000', 600000n)).toBe(1100000n)
    expect(debtAfter('-1', 1n)).toBe(0n)
    expect(debtAfter('900719925474099301', 1n)).toBe(900719925474099302n)
  })
  it('warns about unpriced products and quantities above stock', () => {
    expect(issueLineWarning(line('1'), undefined)).toBeNull()
    expect(
      issueLineWarning(line('1'), quote({ sellingPrice: null })),
    ).toContain('chưa có giá bán')
    expect(issueLineWarning(line('10'), quote())).toBeNull()
    expect(issueLineWarning(line('10.001'), quote())).toBe(
      'Vượt tồn hiện tại (10 Cây).',
    )
    expect(issueLineWarning(line('bad'), quote())).toBeNull()
  })
  it('limits a payment to the current debt plus a reversed amount', () => {
    expect(paymentLimit('500000')).toBe(500000n)
    expect(paymentLimit('-20000')).toBe(-20000n)
    expect(paymentLimit('200000', 300000n)).toBe(500000n)
    expect(paymentLimit('0')).toBe(0n)
    for (const bad of [null, undefined, '', '1.5', 'abc', '01'])
      expect(paymentLimit(bad)).toBeNull()
  })
})
