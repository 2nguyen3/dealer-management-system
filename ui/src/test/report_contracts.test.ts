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

describe('source dashboard validation', () => {
  it('validates all sections and optional omissions preserving exact strings', () => {
    const data = dashboardFixture()
    expect(parseDashboard(data, data.month)).toBe(data)
    expect(
      parseDashboard({ month: data.month, asOf: data.asOf }, data.month),
    ).toEqual({ month: data.month, asOf: data.asOf })
  })

  it('rejects null, wrong shapes, excessive top/trend sizes, unknown fields and mismatched month', () => {
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
        receivables: {
          ...data.receivables,
          topAgencies: Array.from(
            { length: 11 },
            () => data.receivables.topAgencies[0],
          ),
        },
      },
      { ...data, pendingIssueCount: '0' },
      { ...data, verifiedUnreceiptedAmount: 0 },
      { ...data, invented: '0' },
    ])
      expect(() => parseDashboard(value, data.month)).toThrow()
    expect(() => parseDashboard(data, '2026-09')).toThrow(/không khớp/)
  })
})
