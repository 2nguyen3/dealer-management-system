import { describe, expect, it } from 'vitest'
import type { ReportRow } from '../features/reports/contracts'
import {
  columnLabels,
  displayValue,
  isNumeric,
  sortLabel,
  sortableColumns,
  valueKind,
  visibleColumns,
} from '../features/reports/display'
import {
  allZero,
  compositionOf,
  debtFlow,
  flowData,
  flowRoles,
  inventoryCounts,
  isAgencyReport,
  rankRows,
  remainder,
  rowIdentity,
  salesShare,
  timelineRows,
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

function agency(id: string, amount: string): ReportRow {
  return {
    agencyId: id,
    agencyCode: `DL-${id}`,
    agencyName: `Đại lý ${id}`,
    numberOfIssues: 1,
    salesAmount: amount,
    salesRate: '0',
  }
}

function day(date: string, cash: string, total = cash): ReportRow {
  return {
    businessDate: date,
    receiptCount: 1,
    cashAmount: cash,
    bankTransferAmount: '0',
    onlineAmount: '0',
    totalAmount: total,
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
    const data = rankRows('sales', items, ['salesAmount'])
    expect(data).toHaveLength(10)
    expect(data[0]!.id).toBe('12')
    expect(data[0]!.salesAmount).toBe(110)
    expect(data[0]!.display.salesAmount).toBe('110 ₫')
    expect(data[0]!.name).toBe('DL-12 — Đại lý 12')
    expect(data.some((d) => d.id === '1')).toBe(false)
    const coded = rankRows('sales', items, ['numberOfIssues'], {
      limit: 3,
      axis: 'code',
      measure: 'salesAmount',
    })
    expect(coded.map((d) => d.label)).toEqual(['DL-12', 'DL-11', 'DL-10'])
    expect(rankRows('sales', [], ['salesAmount'])).toEqual([])
  })

  it('identifies agencies, products and collection days', () => {
    expect(isAgencyReport('sales')).toBe(true)
    expect(isAgencyReport('debt')).toBe(true)
    expect(isAgencyReport('collections')).toBe(false)
    expect(isAgencyReport('product-sales')).toBe(false)
    const row = reportFixture('product-sales').items[0] as ReportRow
    expect(rowIdentity('product-sales', row)).toEqual({
      id: '9223372036854775807',
      code: 'MH-01',
      name: 'Mặt hàng nguồn (Kg)',
    })
    expect(rowIdentity('collections', day('2026-10-05', '1'))).toEqual({
      id: '2026-10-05',
      code: '05/10',
      name: '05/10/2026',
    })
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abc', 4)).toBe('abc')
  })

  it('orders collection days chronologically and keeps only the last days', () => {
    const items = [
      day('2026-10-03', '30'),
      day('2026-10-01', '10'),
      day('2026-10-02', '20'),
    ]
    const data = timelineRows('collections', items, ['cashAmount'])
    expect(data.map((d) => d.id)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ])
    expect(data[0]!.label).toBe('01/10')
    expect(data[0]!.name).toBe('01/10/2026')
    expect(data[2]!.cashAmount).toBe(30)
    expect(
      timelineRows('collections', items, ['cashAmount'], 2).map((d) => d.id),
    ).toEqual(['2026-10-02', '2026-10-03'])
    expect(timelineRows('collections', [], ['cashAmount'])).toEqual([])
  })

  it('detects charts with nothing to draw', () => {
    const data = rankRows('sales', [agency('1', '0')], ['salesAmount'])
    expect(allZero(data, ['salesAmount'])).toBe(true)
    const some = rankRows('sales', [agency('1', '1')], ['salesAmount'])
    expect(allZero(some, ['salesAmount'])).toBe(false)
    expect(allZero([], ['salesAmount'])).toBe(true)
  })

  it('maps debt totals into the opening + increase − paid = closing flow', () => {
    const totals = reportFixture('debt').totals as ReportRow
    expect(debtFlow.map((step) => step.key)).toEqual([
      'openingDebt',
      'debtIncrease',
      'paidAmount',
      'closingDebt',
    ])
    const data = flowData(totals, debtFlow)
    expect(data.map((d) => d.id)).toEqual(debtFlow.map((s) => s.key))
    expect(data[0]!.fill).toBe(flowRoles.balance.color)
    expect(data[1]!.fill).toBe(flowRoles.increase.color)
    expect(data[2]!.fill).toBe(flowRoles.decrease.color)
    // A prepaid (negative) opening balance keeps its sign.
    expect(data[0]!.value).toBe(-5)
    expect(data[0]!.display.value).toBe('-5 ₫')
    expect(data[1]!.display.value).not.toBe(huge)
    expect(flowData(undefined, debtFlow)).toEqual([])
  })

  it('counts inventory products by movement, issue and stock-out (zero or negative)', () => {
    const base = reportFixture('inventory').items[0] as ReportRow
    expect(
      inventoryCounts([
        base,
        {
          ...base,
          productId: '2',
          receiptQuantity: '0.000',
          issueQuantity: '1',
          closingStock: '4.5',
        },
        { ...base, productId: '3', receiptQuantity: '0', closingStock: '-2' },
      ]),
    ).toEqual({ products: 3, moving: 2, issued: 1, outOfStock: 2 })
    expect(inventoryCounts([])).toEqual({
      products: 0,
      moving: 0,
      issued: 0,
      outOfStock: 0,
    })
  })

  it('computes the filtered share of company sales only when company sales are positive', () => {
    expect(salesShare({ salesAmount: '50', companySalesAmount: '200' })).toBe(
      0.25,
    )
    expect(salesShare({ salesAmount: '0', companySalesAmount: '0' })).toBeNull()
    expect(salesShare(undefined)).toBeNull()
  })

  it('subtracts whole-VND strings exactly, never below zero', () => {
    expect(remainder(huge + '00', huge)).toBe(
      (BigInt(huge + '00') - BigInt(huge)).toString(),
    )
    expect(remainder('5', '5')).toBe('0')
    expect(remainder('5', '9')).toBe('0')
    expect(remainder(undefined, undefined)).toBe('0')
    expect(remainder('x', '1')).toBe('0')
  })

  it('builds the sales donut as filtered agencies versus the rest of the company', () => {
    const sales = compositionOf(
      'sales',
      { numberOfIssues: 1, salesAmount: '250', companySalesAmount: '1000' },
      [],
    )
    expect(sales.shape).toBe('donut')
    expect(sales.centerValue).toBe(formatCompactVND(1000))
    expect(
      sales.parts.map((part) => [part.key, part.value, part.ratio]),
    ).toEqual([
      ['salesAmount', 250, 0.25],
      ['others', 750, 0.75],
    ])
    expect(sales.parts[1]!.display).toBe('750 ₫')
  })

  it('builds the collections donut from channel totals', () => {
    const totals = reportFixture('collections').totals as ReportRow
    const mix = compositionOf('collections', totals, [])
    expect(mix.centerValue).toBe(formatCompactVND(3))
    expect(mix.parts.map((part) => [part.key, part.value])).toEqual([
      ['cashAmount', 1],
      ['bankTransferAmount', 2],
      ['onlineAmount', 0],
    ])
    expect(mix.parts[1]!.ratio).toBeCloseTo(2 / 3)
    expect(mix.parts[2]!.ratio).toBe(0)
  })

  it('never draws a negative slice and handles missing totals', () => {
    const debt = compositionOf(
      'debt',
      { ...(reportFixture('debt').totals as ReportRow), closingDebt: '-9' },
      [],
    )
    expect(debt.parts.map((part) => part.key)).toEqual([
      'debtIncrease',
      'paidAmount',
    ])
    expect(debt.centerValue).toBe(formatCompactVND(-9))
    const empty = compositionOf('debt', undefined, [])
    expect(
      empty.parts.every((part) => part.value === 0 && part.ratio === 0),
    ).toBe(true)
    expect(empty.parts[0]!.display).toBe('—')
    expect(compositionOf('sales', undefined, []).parts[1]!.display).toBe('—')
  })

  it('ranks the leading products and groups the rest of the total', () => {
    const product = (id: string, amount: string) =>
      ({
        ...reportFixture('product-sales').items[0]!,
        productId: id,
        productName: `MH ${id}`,
        salesAmount: amount,
      }) as ReportRow
    const items = ['10', '50', '20', '40', '30'].map((amount, i) =>
      product(String(i + 1), amount),
    )
    const mix = compositionOf('product-sales', { salesAmount: '200' }, items)
    expect(mix.parts.map((part) => part.label)).toEqual([
      'MH 2',
      'MH 4',
      'MH 5',
      'MH 3',
      'Mặt hàng khác',
    ])
    expect(mix.parts.at(-1)!.value).toBe(60)
    expect(mix.centerValue).toBe(formatCompactVND(200))
    const none = compositionOf('product-sales', undefined, [])
    expect(none.parts).toHaveLength(1)
    expect(none.parts[0]!.display).toBe('—')
  })

  it('builds inventory rings as shares of the products on the page', () => {
    const row = (closing: string, receipt: string, issue: string) =>
      ({
        ...reportFixture('inventory').items[0]!,
        closingStock: closing,
        receiptQuantity: receipt,
        issueQuantity: issue,
      }) as ReportRow
    const rings = compositionOf('inventory', undefined, [
      row('0', '1', '0'),
      row('5', '0', '0'),
      row('-1', '0', '2'),
      row('2', '3', '1'),
    ])
    expect(rings.shape).toBe('rings')
    expect(rings.centerValue).toBe('4')
    expect(rings.parts.map((part) => [part.key, part.ratio])).toEqual([
      ['moving', 0.75],
      ['issued', 0.5],
      ['outOfStock', 0.5],
    ])
    expect(rings.parts[1]!.display).toBe('2 / 4')
    expect(compositionOf('inventory', undefined, []).parts[0]!.ratio).toBe(0)
    expect(toNumber(rings.centerValue)).toBe(4)
  })
})

describe('report display', () => {
  it('formats dates, counts, money and percentages by column kind', () => {
    expect(valueKind('businessDate')).toBe('date')
    expect(displayValue('businessDate', '2026-10-05')).toBe('05/10/2026')
    expect(isNumeric('businessDate')).toBe(false)
    expect(valueKind('receiptCount')).toBe('count')
    expect(isNumeric('receiptCount')).toBe(true)
    for (const key of [
      'cashAmount',
      'bankTransferAmount',
      'onlineAmount',
      'totalAmount',
      'paidAmount',
      'companySalesAmount',
    ])
      expect(valueKind(key), key).toBe('money')
    expect(displayValue('closingDebt', '-1500')).toBe('-1.500 ₫')
    expect(valueKind('closingStock')).toBe('quantity')
    expect(displayValue('salesRate', '12.5')).toContain('%')
    expect(displayValue('agencyName', '')).toBe('—')
    expect(displayValue('businessDate', null)).toBe('—')
    expect(valueKind('netSalesAmount')).toBe('text')
  })

  it('shows contract columns only and sorts headers from the contract enum', () => {
    expect(visibleColumns('collections')).toEqual([
      'businessDate',
      'receiptCount',
      'cashAmount',
      'bankTransferAmount',
      'onlineAmount',
      'totalAmount',
    ])
    expect(visibleColumns('debt')).toEqual([
      'agencyCode',
      'agencyName',
      'openingDebt',
      'debtIncrease',
      'paidAmount',
      'closingDebt',
    ])
    expect([...sortableColumns('collections')]).toEqual([
      'businessDate',
      'totalAmount',
    ])
    expect([...sortableColumns('sales')].sort()).toEqual([
      'numberOfIssues',
      'salesAmount',
    ])
    for (const kind of ['sales', 'collections'] as const)
      for (const column of visibleColumns(kind))
        expect(columnLabels[column], column).toBeTruthy()
    expect(sortLabel('-businessDate')).toBe('Ngày: mới nhất trước')
    expect(sortLabel('businessDate')).toBe('Ngày: cũ nhất trước')
    expect(sortLabel('-totalAmount')).toBe('Tổng thu: cao đến thấp')
  })
})
