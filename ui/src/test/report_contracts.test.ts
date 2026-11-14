import { describe, expect, it } from 'vitest'
import {
  businessDate,
  catalogId,
  count,
  id,
  instant,
  money,
  month,
  parseReport,
  quantity,
  reportPath,
  reports,
  rowRules,
  signedMoney,
  signedQuantity,
  vietnamMonth,
  type ReportKind,
  type ReportQuery,
} from '../features/reports/contracts'
import { parseDashboard } from '../features/dashboard/contracts'
import {
  dashboardFixture,
  huge,
  reportFixture,
  reportQuery,
} from './reportFixtures'

describe('exact source report validation', () => {
  it.each(Object.keys(reports) as ReportKind[])(
    'validates every required %s field without number coercion',
    (kind) => {
      const data = reportFixture(kind)
      expect(parseReport(data, kind, data.fromDate, data.toDate)).toBe(data)
      for (const key of Object.keys(rowRules[kind])) {
        const changed = structuredClone(data) as unknown as {
          items: Record<string, unknown>[]
        }
        changed.items[0]![key] = null
        expect(
          () => parseReport(changed, kind, data.fromDate, data.toDate),
          key,
        ).toThrow()
      }
      const totals = data.totals
      if (totals)
        for (const key of Object.keys(totals)) {
          const changed = structuredClone(data) as unknown as {
            totals: Record<string, unknown>
          }
          changed.totals[key] = null
          expect(
            () => parseReport(changed, kind, data.fromDate, data.toDate),
            key,
          ).toThrow()
        }
    },
  )

  it.each([null, [], {}, { items: [] }, '0', 0])(
    'rejects malformed response %j',
    (value) => {
      expect(() =>
        parseReport(value, 'sales', '2026-10-01', '2026-11-01'),
      ).toThrow()
    },
  )

  it('rejects invalid period, timestamp, pagination, unknown/legacy fields and mismatched period', () => {
    const good = reportFixture('sales')
    for (const patch of [
      { fromDate: '2026-02-30' },
      { generatedAt: '2026-10-01' },
      { pagination: { limit: 0, hasMore: false, nextCursor: null } },
      { pagination: { limit: 101, hasMore: false, nextCursor: null } },
      { pagination: { limit: 25, hasMore: true, nextCursor: null } },
      { pagination: { limit: 25, hasMore: false, nextCursor: 'opaque' } },
      { pagination: { limit: 25, hasMore: true, nextCursor: '' } },
      { extra: 'legacy' },
      { salesCount: 1 },
      { totals: { ...good.totals, companyGrossSales: '1' } },
      { items: [{ ...good.items[0], netSalesAmount: '1' }] },
    ])
      expect(() =>
        parseReport({ ...good, ...patch }, 'sales', good.fromDate, good.toDate),
      ).toThrow()
    expect(() => parseReport(good, 'sales', '2026-09-01', good.toDate)).toThrow(
      /không khớp/,
    )
    expect(() =>
      parseReport(
        {
          ...good,
          pagination: { limit: 1, hasMore: false, nextCursor: null },
          items: [good.items[0], good.items[0]],
        },
        'sales',
        good.fromDate,
        good.toDate,
      ),
    ).toThrow(/Phân trang/)
  })

  it.each([
    { rule: money, good: huge, bad: [123, '-1', '00', '1.1', '1e10', '+1'] },
    { rule: signedMoney, good: '-' + huge, bad: [1, '1.1', '01'] },
    { rule: quantity, good: huge + '.001', bad: [0.1, '-1', '1.0001'] },
    { rule: signedQuantity, good: '-' + huge + '.001', bad: ['1.2345', '-01'] },
    {
      rule: id,
      good: '9223372036854775807',
      bad: ['9223372036854775808', '0', '01', 1],
    },
    { rule: catalogId, good: 2147483647, bad: [2147483648, '1', 0, 1.5] },
    { rule: count, good: 0, bad: [-1, 1.2, '1', Number.MAX_SAFE_INTEGER + 1] },
    { rule: month, good: '0001-01', bad: ['0000-01', '2026-13', '2026-1'] },
    {
      rule: businessDate,
      good: '2024-02-29',
      bad: ['2026-02-29', '0000-01-01', '2026-01-01T00:00:00Z'],
    },
    {
      rule: instant,
      good: '2026-10-30T14:39:22.123456+07:00',
      bad: [
        '2026-10-30T00:00:00',
        '2026-02-30T00:00:00Z',
        '2026-10-30T25:00:00Z',
      ],
    },
  ])(
    'keeps exact rule $good and rejects invalid representations',
    ({ rule, good, bad }) => {
      expect(rule(good)).toBe(true)
      for (const value of bad) expect(rule(value), String(value)).toBe(false)
    },
  )

  it('derives the initial calendar month in Vietnam, including year/month boundary', () => {
    expect(vietnamMonth(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01')
    expect(vietnamMonth(new Date('2026-09-30T16:59:59Z'))).toBe('2026-09')
  })

  it.each(Object.keys(reports) as ReportKind[])(
    'builds only supported %s filters and strips all page controls for export',
    (kind) => {
      const query = {
        ...reportQuery(kind),
        filters: {
          agencyId: '9223372036854775807',
          productId: '17',
          typeId: '2147483647',
          wardId: '2',
          receiptType: 'ONLINE',
          madeUpFilter: 'no',
        },
      }
      const read = new URL(reportPath(query, 'opaque+/='), 'http://test')
      expect(read.searchParams.get('cursor')).toBe('opaque+/=')
      expect(read.searchParams.get('limit')).toBe('25')
      for (const filter of reports[kind].filters)
        expect(read.searchParams.get(filter)).toBe(
          query.filters[filter as keyof typeof query.filters],
        )
      expect(read.searchParams.has('madeUpFilter')).toBe(false)
      const exported = new URL(reportPath(query, 'opaque', true), 'http://test')
      expect(exported.searchParams.has('sort')).toBe(false)
      expect(exported.searchParams.has('cursor')).toBe(false)
      expect(exported.searchParams.has('limit')).toBe(false)
      for (const filter of reports[kind].filters)
        expect(exported.searchParams.get(filter)).toBe(
          read.searchParams.get(filter),
        )
    },
  )

  it('rejects invalid interval, operation sort, limit, catalog and bigint filter before network', () => {
    const patches: Partial<ReportQuery>[] = [
      { fromDate: '2026-11-01' },
      { toDate: '2026-02-29' },
      { sort: 'madeUp' },
      { limit: '0' },
      { limit: '101' },
      { filters: { agencyId: '9223372036854775808' } },
      { filters: { typeId: '2147483648' } },
      { filters: { typeId: '01' } },
    ]
    for (const patch of patches)
      expect(() => reportPath({ ...reportQuery(), ...patch })).toThrow()
    expect(() =>
      reportPath({
        ...reportQuery(),
        filters: { agencyId: '9223372036854775808' },
      }),
    ).toThrow('ID đại lý không hợp lệ.')
  })

  it('validates the debt ward filter as an integer catalogue id', () => {
    const debt = (wardId: string) =>
      reportPath({ ...reportQuery('debt'), filters: { wardId } })
    expect(new URL(debt('1'), 'http://t').searchParams.get('wardId')).toBe('1')
    expect(
      new URL(debt('2147483647'), 'http://t').searchParams.get('wardId'),
    ).toBe('2147483647')
    for (const bad of ['0', '01', '2147483648', '-1', '1.5', 'x'])
      expect(() => debt(bad)).toThrow('ID phường/xã không hợp lệ.')
    expect(new URL(debt(''), 'http://t').searchParams.has('wardId')).toBe(false)
  })
})

describe('simplified report fields', () => {
  it('accepts signed opening/closing debt and stock but unsigned flows', () => {
    type Loose = {
      fromDate: string
      toDate: string
      items: Record<string, unknown>[]
      totals: Record<string, unknown>
    }
    const debt = reportFixture('debt') as unknown as Loose
    debt.items[0]!.openingDebt = '-' + huge
    debt.items[0]!.closingDebt = '-1'
    debt.totals.closingDebt = '-1'
    expect(
      parseReport(debt, 'debt', debt.fromDate, debt.toDate).items[0]!
        .closingDebt,
    ).toBe('-1')
    for (const [key, value] of [
      ['debtIncrease', '-1'],
      ['paidAmount', '-1'],
      ['openingDebt', '-01'],
      ['closingDebt', '1.5'],
    ] as const) {
      const bad = structuredClone(debt)
      ;(bad.items[0] as Record<string, unknown>)[key] = value
      expect(
        () => parseReport(bad, 'debt', debt.fromDate, debt.toDate),
        key,
      ).toThrow()
    }
    const stock = reportFixture('inventory') as unknown as Loose
    stock.items[0]!.closingStock = '-2.125'
    expect(
      parseReport(stock, 'inventory', stock.fromDate, stock.toDate).items[0]!
        .closingStock,
    ).toBe('-2.125')
    for (const [key, value] of [
      ['receiptQuantity', '-1'],
      ['issueQuantity', '-0.001'],
      ['closingStock', '-1.0001'],
    ] as const) {
      const bad = structuredClone(stock)
      ;(bad.items[0] as Record<string, unknown>)[key] = value
      expect(
        () => parseReport(bad, 'inventory', stock.fromDate, stock.toDate),
        key,
      ).toThrow()
    }
  })

  it('rejects removed legacy columns on every kind', () => {
    const legacy: Record<ReportKind, string> = {
      sales: 'returnAmount',
      debt: 'cashApplied',
      inventory: 'adjustmentQuantity',
      'product-sales': 'returnedQuantity',
      collections: 'cashRefunded',
    }
    for (const kind of Object.keys(legacy) as ReportKind[]) {
      const data = reportFixture(kind)
      const bad = structuredClone(data) as unknown as {
        items: Record<string, unknown>[]
      }
      bad.items[0]![legacy[kind]] = '0'
      expect(
        () => parseReport(bad, kind, data.fromDate, data.toDate),
        kind,
      ).toThrow()
    }
    expect(Object.keys(reports)).not.toContain('cash-and-credit')
  })

  it('validates collections rows: business date, count and channel amounts', () => {
    const data = reportFixture('collections')
    expect(parseReport(data, 'collections', data.fromDate, data.toDate)).toBe(
      data,
    )
    for (const [key, value] of [
      ['businessDate', '2026-02-30'],
      ['receiptCount', -1],
      ['receiptCount', '3'],
      ['onlineAmount', '-1'],
    ] as const) {
      const bad = structuredClone(data) as unknown as {
        items: Record<string, unknown>[]
      }
      bad.items[0]![key] = value
      expect(
        () => parseReport(bad, 'collections', data.fromDate, data.toDate),
        key,
      ).toThrow()
    }
    const { totals: _omit, ...noTotals } = data
    void _omit
    expect(() =>
      parseReport(noTotals, 'collections', data.fromDate, data.toDate),
    ).toThrow()
  })

  it('sends the collections receipt type only as a contract enum value', () => {
    const path = (receiptType: string) =>
      reportPath({ ...reportQuery('collections'), filters: { receiptType } })
    for (const value of ['CASH', 'BANK_TRANSFER', 'ONLINE'])
      expect(
        new URL(path(value), 'http://t').searchParams.get('receiptType'),
      ).toBe(value)
    expect(new URL(path(''), 'http://t').searchParams.has('receiptType')).toBe(
      false,
    )
    for (const bad of ['cash', 'REFUND', 'CREDIT', ' CASH'])
      expect(() => path(bad)).toThrow(/Hình thức thu không hợp lệ/)
    // Other reports never forward a receipt type.
    expect(
      new URL(
        reportPath({
          ...reportQuery('sales'),
          filters: { receiptType: 'CASH' },
        }),
        'http://t',
      ).searchParams.has('receiptType'),
    ).toBe(false)
  })

  it('uses the new sort enums and the base grant for inventory', () => {
    expect(reports.sales.sorts).toContain('-numberOfIssues')
    expect(reports.sales.sorts).not.toContain('-netSalesAmount')
    expect(reports.debt.sorts).toContain('debtIncrease')
    expect(reports.collections.sorts).toEqual([
      'businessDate',
      '-businessDate',
      'totalAmount',
      '-totalAmount',
    ])
    expect(reports.inventory.permission).toBe('reports.read')
    expect(reports.collections.permission).toBe('debt.read')
    expect(() =>
      reportPath({ ...reportQuery('collections'), sort: '-cashReceived' }),
    ).toThrow()
  })
})

describe('source dashboard validation', () => {
  it('validates all sections and optional omissions preserving exact strings', () => {
    const data = dashboardFixture()
    expect(parseDashboard(data, data.month)).toBe(data)
    expect(
      parseDashboard({ month: data.month, asOf: data.asOf }, data.month),
    ).toEqual({ month: data.month, asOf: data.asOf })
  })

  it('rejects null, wrong shapes, excessive top/trend sizes, removed/unknown fields and mismatched month', () => {
    const data = dashboardFixture()
    for (const value of [
      null,
      [],
      {},
      { ...data, agencies: null },
      {
        ...data,
        sales: {
          ...data.sales,
          monthlyTrend: Array.from(
            { length: 13 },
            () => data.sales.monthlyTrend[0],
          ),
        },
      },
      {
        ...data,
        sales: {
          ...data.sales,
          topProducts: Array.from(
            { length: 11 },
            () => data.sales.topProducts[0],
          ),
        },
      },
      {
        ...data,
        debt: {
          ...data.debt,
          topAgencies: Array.from(
            { length: 11 },
            () => data.debt.topAgencies[0],
          ),
        },
      },
      { ...data, sales: { ...data.sales, gross: '1' } },
      { ...data, collections: { ...data.collections, receiptCount: '5' } },
      { ...data, debt: { ...data.debt, totalDebt: '-1' } },
      { ...data, debt: { ...data.debt, prepaidAmount: '-1' } },
      { ...data, drafts: { stockReceipts: -1 } },
      { ...data, drafts: { refunds: 1 } },
      { ...data, inventory: { productCount: 1 } },
      { ...data, receivables: {} },
      { ...data, pendingIssueCount: 0 },
      { ...data, verifiedUnreceiptedAmount: '0' },
      { ...data, invented: '0' },
    ])
      expect(() => parseDashboard(value, data.month)).toThrow()
    expect(() => parseDashboard(data, '2026-09')).toThrow(/không khớp/)
  })

  it('accepts partial drafts, negative agency debt and a null debt ratio', () => {
    const data = dashboardFixture()
    const partial = { ...data, drafts: { stockIssues: 0 } }
    expect(parseDashboard(partial, data.month).drafts).toEqual({
      stockIssues: 0,
    })
    expect(parseDashboard({ ...data, drafts: {} }, data.month).drafts).toEqual(
      {},
    )
    const point = data.debt.topAgencies[0]!
    const prepaid = {
      ...data,
      debt: {
        ...data.debt,
        topAgencies: [
          { ...point, debt: '-250', maxDebt: '0', debtRatio: null },
        ],
      },
    }
    expect(parseDashboard(prepaid, data.month).debt!.topAgencies[0]).toEqual({
      ...point,
      debt: '-250',
      maxDebt: '0',
      debtRatio: null,
    })
  })

  it.each([
    ['0', true],
    ['100', true],
    ['150.5', true],
    ['12.34', true],
    ['12.345', false],
    ['-1', false],
    ['01', false],
    [12, false],
  ] as const)('debtRatio %j valid=%s', (debtRatio, valid) => {
    const data = dashboardFixture()
    const value = {
      ...data,
      debt: {
        ...data.debt,
        topAgencies: [{ ...data.debt.topAgencies[0]!, debtRatio }],
      },
    }
    if (valid) expect(parseDashboard(value, data.month).debt).toBeTruthy()
    else expect(() => parseDashboard(value, data.month)).toThrow()
  })

  it.each([
    ['debt', '1000000000000000000'],
    ['debt', '-01'],
    ['maxDebt', '-1'],
  ] as const)('rejects topAgencies %s %j', (key, value) => {
    const data = dashboardFixture()
    const bad = {
      ...data,
      debt: {
        ...data.debt,
        topAgencies: [{ ...data.debt.topAgencies[0]!, [key]: value }],
      },
    }
    expect(() => parseDashboard(bad, data.month)).toThrow()
  })
})
