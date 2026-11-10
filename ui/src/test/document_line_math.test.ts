import { describe, expect, it } from 'vitest'
import {
  lineAmount,
  quantitySign,
  scaledQuantity,
  sumAmounts,
} from '../features/document_history/lineMath'
import {
  canEstimate,
  estimateLine,
  summarizeLines,
} from '../features/stock_receipts/lineEstimates'
import type { DocumentLine } from '../features/document_history/documentContracts'

const line = (quantity: string, unitPrice = '', originLineId = '') => ({
  productId: '1',
  originLineId,
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

describe('goods editor estimates', () => {
  const origin = [
    { id: '201', unitPrice: '1000' } as DocumentLine,
    { id: '202', unitPrice: '333' } as DocumentLine,
  ]
  it('estimates receipts from the entered price and returns from the origin line', () => {
    expect(canEstimate('STOCK_RECEIPT')).toBe(true)
    expect(canEstimate('SALES_RETURN', null)).toBe(false)
    expect(canEstimate('SALES_RETURN', origin)).toBe(true)
    expect(canEstimate('STOCK_ISSUE')).toBe(false)
    expect(estimateLine('STOCK_RECEIPT', line('2', '150'))).toBe(300n)
    expect(estimateLine('SALES_RETURN', line('1.5', '', '202'), origin)).toBe(
      500n,
    )
    expect(estimateLine('SALES_RETURN', line('1', '', '999'), origin)).toBe(
      null,
    )
    expect(estimateLine('STOCK_ISSUE', line('1', '100'))).toBeNull()
  })
  it('summarizes counts, priced lines and adjustment directions', () => {
    expect(
      summarizeLines('STOCK_RECEIPT', [line('2', '150'), line('', '1')]),
    ).toEqual({
      lineCount: 2,
      pricedLines: 1,
      subtotal: 300n,
      increases: 1,
      decreases: 0,
    })
    const adjustment = summarizeLines('STOCK_ADJUSTMENT', [
      line('-1'),
      line('2'),
      line('0'),
    ])
    expect([adjustment.increases, adjustment.decreases]).toEqual([1, 1])
    expect(adjustment.subtotal).toBe(0n)
  })
})
