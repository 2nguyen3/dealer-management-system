import { describe, expect, it } from 'vitest'
import type { ReportRow } from '../features/reports/contracts'
import {
  allZero,
  compositionOf,
  debtFlow,
  flowData,
  flowRoles,
  inventoryCounts,
  rankRows,
  returnRatio,
  rowIdentity,
  truncate,
} from '../features/reports/insights'
import {
  defaultQuery,
  matchingPreset,
  monthPeriod,
  presetPeriod,
  shiftDate,
  shiftMonth,
} from '../features/reports/periods'
import { formatCompactVND, toNumber } from '../lib/chart'
import { huge, reportFixture } from './reportFixtures'

function agency(id: string, net: string): ReportRow {
  return {
    agencyId: id,
    agencyCode: `DL-${id}`,
    agencyName: `Đại lý ${id}`,
    salesAmount: net.replace('-', ''),
    returnAmount: '0',
    netSalesAmount: net,
  }
}

describe('report periods', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-05', 0)).toBe('2026-05')
    expect(shiftMonth('2026-11', -14)).toBe('2025-09')
  })

  it('shifts business dates by days and leaves invalid input unchanged', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDate('not-a-date', 1)).toBe('not-a-date')
  })

  it('builds half-open preset periods', () => {
    expect(monthPeriod('2026-12')).toEqual({
      fromDate: '2026-12-01',
      toDate: '2027-01-01',
    })
    expect(presetPeriod('lastMonth', '2026-01')).toEqual({
      fromDate: '2025-12-01',
      toDate: '2026-01-01',
    })
    expect(presetPeriod('thisQuarter', '2026-11')).toEqual({
      fromDate: '2026-10-01',
      toDate: '2027-01-01',
    })
    expect(presetPeriod('thisQuarter', '2026-01')).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-04-01',
    })
    expect(presetPeriod('thisYear', '2026-07')).toEqual({
      fromDate: '2026-01-01',
      toDate: '2027-01-01',
    })
  })

  it('recognises presets and reports custom ranges as empty', () => {
    expect(matchingPreset(monthPeriod('2026-11'), '2026-11')).toBe('thisMonth')
    expect(matchingPreset(monthPeriod('2026-10'), '2026-11')).toBe('lastMonth')
    expect(
      matchingPreset(
        { fromDate: '2026-11-02', toDate: '2026-12-01' },
        '2026-11',
      ),
    ).toBe('')
  })

  it('defaults each report to its first sort, no filters and 25 rows', () => {
    expect(defaultQuery('inventory', '2026-11')).toEqual({
      kind: 'inventory',
      fromDate: '2026-11-01',
      toDate: '2026-12-01',
      filters: {},
      sort: 'productId',
      limit: '25',
    })
    expect(defaultQuery('product-sales', '2026-11').sort).toBe('-salesAmount')
  })
})

describe('report insights', () => {
  it('ranks the page by a measure, limits it and keeps exact display values', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      agency(String(i + 1), String(i * 10)),
    )
    items.push(agency('99', '-5'))
    const data = rankRows('sales', items, ['netSalesAmount'])
    expect(data).toHaveLength(10)
    expect(data[0]!.id).toBe('12')
    expect(data[0]!.netSalesAmount).toBe(110)
    expect(data[0]!.display.netSalesAmount).toBe('110 ₫')
    expect(data[0]!.name).toBe('DL-12 — Đại lý 12')
    expect(data.some((d) => d.id === '99')).toBe(false)
    const coded = rankRows('sales', items, ['salesAmount'], {
      limit: 3,
      axis: 'code',
      measure: 'netSalesAmount',
    })
    expect(coded.map((d) => d.label)).toEqual(['DL-12', 'DL-11', 'DL-10'])
    expect(rankRows('sales', [], ['netSalesAmount'])).toEqual([])
  })

  it('labels products with their unit and truncates long axis labels', () => {
    const row = reportFixture('product-sales').items[0] as ReportRow
    expect(rowIdentity('product-sales', row)).toEqual({
      id: '9223372036854775807',
      code: 'MH-01',
      name: 'Mặt hàng nguồn (Kg)',
    })
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abc', 4)).toBe('abc')
  })

  it('detects charts with nothing to draw', () => {
    const data = rankRows('sales', [agency('1', '0')], ['netSalesAmount'])
    expect(allZero(data, ['netSalesAmount'])).toBe(true)
    const some = rankRows('sales', [agency('1', '-1')], ['netSalesAmount'])
    expect(allZero(some, ['netSalesAmount'])).toBe(false)
    expect(allZero([], ['netSalesAmount'])).toBe(true)
  })

  it('maps totals into role-coloured flow components', () => {
    const totals = reportFixture('debt').totals as ReportRow
    const data = flowData(totals, debtFlow)
    expect(data.map((d) => d.id)).toEqual(debtFlow.map((s) => s.key))
    expect(data[0]!.fill).toBe(flowRoles.balance.color)
    expect(data[1]!.fill).toBe(flowRoles.increase.color)
    expect(data[2]!.fill).toBe(flowRoles.decrease.color)
    expect(data[0]!.display.value).toContain('₫')
    expect(data[0]!.display.value).not.toBe(huge)
    expect(flowData(undefined, debtFlow)).toEqual([])
  })

  it('counts inventory products by movement, stock-out and adjustment', () => {
    const base = reportFixture('inventory').items[0] as ReportRow
    expect(
      inventoryCounts([
        base,
        {
          ...base,
          productId: '2',
          receiptQuantity: '0.000',
          adjustmentQuantity: '0',
          closingStock: '4.5',
        },
      ]),
    ).toEqual({ products: 2, moving: 1, outOfStock: 1, adjusted: 1 })
    expect(inventoryCounts([])).toEqual({
      products: 0,
      moving: 0,
      outOfStock: 0,
      adjusted: 0,
    })
  })

  it('computes the return share only when gross sales are positive', () => {
    expect(returnRatio({ salesAmount: '200', returnAmount: '50' })).toBe(0.25)
    expect(returnRatio({ salesAmount: '0', returnAmount: '0' })).toBeNull()
    expect(returnRatio(undefined)).toBeNull()
  })

  it('builds donut compositions from full-filter totals', () => {
    const sales = compositionOf(
      'sales',
      { salesAmount: '1000', returnAmount: '250', netSalesAmount: '750' },
      [],
    )
    expect(sales.shape).toBe('donut')
    expect(sales.centerValue).toBe(formatCompactVND(1000))
    expect(
      sales.parts.map((part) => [part.key, part.value, part.ratio]),
    ).toEqual([
      ['netSalesAmount', 750, 0.75],
      ['returnAmount', 250, 0.25],
    ])
    expect(sales.parts[0]!.display).toBe('750 ₫')
    // Negative net sales never draws a negative slice; exact text is kept.
    const negative = compositionOf(
      'product-sales',
      { salesAmount: huge, returnAmount: '1', netSalesAmount: '-1' },
      [],
    )
    expect(negative.parts[0]!.value).toBe(0)
    expect(negative.parts[0]!.display).toBe('-1 ₫')
    expect(negative.parts[1]!.ratio).toBe(1)
    expect(negative.centerValue).toBe(formatCompactVND(toNumber(huge)))
    // Cash: the centre is the sum of the plotted parts.
    const cash = compositionOf(
      'cash-and-credit',
      reportFixture('cash-and-credit').totals,
      [],
    )
    expect(cash.centerValue).toBe(formatCompactVND(11))
    expect(cash.parts.map((part) => part.key)).toEqual([
      'creditApplied',
      'creditRefunded',
    ])
    // Zero or missing totals: zero ratios, no division by zero.
    const debt = compositionOf('debt', undefined, [])
    expect(
      debt.parts.every((part) => part.value === 0 && part.ratio === 0),
    ).toBe(true)
    expect(debt.parts[0]!.display).toBe('—')
  })

  it('builds inventory rings as shares of the products on the page', () => {
    const row = (closing: string, receipt: string, adjust: string) =>
      ({
        ...reportFixture('inventory').items[0]!,
        closingStock: closing,
        receiptQuantity: receipt,
        issueQuantity: '0',
        adjustmentQuantity: adjust,
      }) as ReportRow
    const rings = compositionOf('inventory', undefined, [
      row('0', '1', '0'),
      row('5', '0', '0'),
      row('0', '0', '-1'),
      row('2', '3', '0'),
    ])
    expect(rings.shape).toBe('rings')
    expect(rings.centerValue).toBe('4')
    expect(rings.parts.map((part) => [part.key, part.ratio])).toEqual([
      ['moving', 0.5],
      ['outOfStock', 0.5],
      ['adjusted', 0.25],
    ])
    expect(rings.parts[2]!.display).toBe('1 / 4')
    expect(compositionOf('inventory', undefined, []).parts[0]!.ratio).toBe(0)
  })
})
