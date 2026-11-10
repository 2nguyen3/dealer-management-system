import { describe, expect, it } from 'vitest'
import {
  dateRangeParams,
  nextDay,
  vietnamInstant,
} from '../features/payment_receipts/contracts'
import {
  agingBuckets,
  balanceSeries,
} from '../features/receivables/statementModel'
import { readyIssue } from '../features/upfront_payments/readyIssue'

describe('finance date helpers', () => {
  it('nextDay crosses month, year and leap-day boundaries', () => {
    expect(nextDay('2026-10-05')).toBe('2026-10-06')
    expect(nextDay('2026-10-31')).toBe('2026-11-01')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
    expect(nextDay('2028-02-28')).toBe('2028-02-29')
    expect(() => nextDay('2026-02-30')).toThrow()
  })

  it('dateRangeParams sends an exclusive upper bound and rejects inverted ranges', () => {
    expect(dateRangeParams('', '')).toEqual({
      params: { fromDate: '', toDate: '' },
      error: '',
    })
    expect(dateRangeParams('2026-10-01', '2026-10-01')).toEqual({
      params: { fromDate: '2026-10-01', toDate: '2026-10-02' },
      error: '',
    })
    expect(
      dateRangeParams(
        '2026-10-01',
        '2026-10-31',
        ['createdFrom', 'createdTo'],
        true,
      ),
    ).toEqual({
      params: {
        createdFrom: '2026-10-01T00:00:00+07:00',
        createdTo: '2026-11-01T00:00:00+07:00',
      },
      error: '',
    })
    const inverted = dateRangeParams('2026-10-05', '2026-10-04')
    expect(inverted.params).toEqual({})
    expect(inverted.error).toMatch(/Ngày bắt đầu/)
  })

  it('vietnamInstant adds the +07:00 offset and validates the wall time', () => {
    expect(vietnamInstant('2026-10-09T10:30')).toBe('2026-10-09T10:30:00+07:00')
    expect(vietnamInstant('2026-10-09T23:59:59')).toBe(
      '2026-10-09T23:59:59+07:00',
    )
    for (const bad of [
      '',
      '2026-10-09',
      '2026-10-09T24:00',
      '2026-13-01T10:00',
    ])
      expect(() => vietnamInstant(bad)).toThrow()
  })
})

describe('statement model', () => {
  const entry = (id: string, balanceAfter: string, isEffective = true) => ({
    id,
    sourceDocumentCode: `PX-${id}`,
    businessDate: '2026-09-15',
    balanceAfter,
    isEffective,
  })

  it('balanceSeries keeps effective entries in order with exact raw values', () => {
    expect(
      balanceSeries([
        entry('1', '1000'),
        entry('2', '500', false),
        entry('3', '2500.5'),
      ]),
    ).toEqual([
      {
        key: '1',
        date: '15/09/2026',
        code: 'PX-1',
        balance: 1000,
        raw: '1000',
      },
      {
        key: '3',
        date: '15/09/2026',
        code: 'PX-3',
        balance: 2500.5,
        raw: '2500.5',
      },
    ])
    expect(balanceSeries([])).toEqual([])
  })

  it('agingBuckets groups outstanding amounts by day boundaries', () => {
    const buckets = agingBuckets(
      [
        { businessDate: '2026-11-11', outstanding: '100' },
        { businessDate: '2026-10-12', outstanding: '200' },
        { businessDate: '2026-10-11', outstanding: '300' },
        { businessDate: '2026-08-13', outstanding: '400' },
        { businessDate: '2026-08-12', outstanding: '500' },
        { businessDate: '2026-01-01', outstanding: '0' },
        { businessDate: '2026-12-01', outstanding: '50' },
      ],
      '2026-11-11',
    )
    expect(
      buckets.map((bucket) => [bucket.key, bucket.amount, bucket.count]),
    ).toEqual([
      ['0-30', 350, 3],
      ['31-60', 300, 1],
      ['61-90', 400, 1],
      ['90+', 500, 1],
    ])
  })
})

describe('readyIssue', () => {
  const issue = (overrides: Record<string, unknown> = {}) => ({
    id: '301',
    code: 'PX-301',
    status: 'PENDING',
    upfrontConfirmationId: null,
    currentRevision: {
      id: '3010',
      revisionNo: 2,
      state: 'READY',
      immediatePayment: '1250000',
      agencySnapshot: { name: 'Đại lý Minh Phát' },
    },
    ...overrides,
  })

  it('returns the current READY revision with no problem', () => {
    expect(readyIssue(issue())).toEqual({
      documentId: '301',
      code: 'PX-301',
      agencyName: 'Đại lý Minh Phát',
      revisionId: '3010',
      revisionNo: '2',
      revisionState: 'READY',
      immediatePayment: '1250000',
      problem: null,
    })
  })

  it('reports why a revision cannot be verified', () => {
    expect(readyIssue(issue({ status: 'POSTED' })).problem).toMatch(/Sẵn sàng/)
    expect(readyIssue(issue({ upfrontConfirmationId: '9' })).problem).toMatch(
      /đã có khoản thực nhận/,
    )
    expect(
      readyIssue(
        issue({
          currentRevision: {
            ...issue().currentRevision,
            immediatePayment: '0',
          },
        }),
      ).problem,
    ).toMatch(/không có khoản trả ngay/)
  })

  it('rejects malformed server data', () => {
    expect(() => readyIssue(null)).toThrow()
    expect(() =>
      readyIssue(issue({ currentRevision: { id: 'x', state: 'READY' } })),
    ).toThrow()
    expect(() =>
      readyIssue(
        issue({
          currentRevision: {
            ...issue().currentRevision,
            immediatePayment: 'abc',
          },
        }),
      ),
    ).toThrow()
  })
})
