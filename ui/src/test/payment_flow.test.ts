import { describe, expect, it } from 'vitest'
import { paymentFlowSteps } from '../features/online_payments/paymentFlow'
import {
  documentLifecycle,
  flowOutcome,
  flowProgress,
  groupTotals,
  upfrontLifecycle,
  type FlowStep,
} from '../features/payment_receipts/flow'
import {
  limitUsage,
  usageBuckets,
} from '../features/receivables/statementModel'

const states = (steps: FlowStep[] | null) => steps?.map((step) => step.state)

describe('paymentFlowSteps (server status only)', () => {
  it('places PENDING on the agency payment step', () => {
    const steps = paymentFlowSteps('PENDING', null)!
    expect(steps.map((step) => step.label)).toEqual([
      'Tạo giao dịch',
      'Đại lý thanh toán trên VNPAY',
      'Cổng xác nhận (IPN)',
      'Phiếu thu ghi nhận',
    ])
    expect(states(steps)).toEqual(['done', 'current', 'upcoming', 'upcoming'])
    expect(flowOutcome(steps)).toBe('active')
    expect(flowProgress(steps)).toBe(25)
  })

  it('completes SUCCESS only when the receipt is linked', () => {
    const steps = paymentFlowSteps('SUCCESS', '502')!
    expect(states(steps)).toEqual(['done', 'done', 'done', 'done'])
    expect(flowOutcome(steps)).toBe('complete')
    expect(flowProgress(steps)).toBe(100)
    expect(states(paymentFlowSteps('SUCCESS', null))).toEqual([
      'done',
      'done',
      'done',
      'current',
    ])
    expect(states(paymentFlowSteps('SUCCESS', ''))).toEqual([
      'done',
      'done',
      'done',
      'current',
    ])
  })

  it('draws FAILED and EXPIRED as terminal branches', () => {
    const failed = paymentFlowSteps('FAILED', null)!
    expect(states(failed)).toEqual(['done', 'done', 'failed', 'skipped'])
    expect(flowOutcome(failed)).toBe('failed')
    const expired = paymentFlowSteps('EXPIRED', null)!
    expect(states(expired)).toEqual(['done', 'expired', 'skipped', 'skipped'])
    expect(flowOutcome(expired)).toBe('expired')
    expect(flowProgress(expired)).toBe(25)
  })

  it.each([
    ['UNKNOWN', null],
    ['success', '502'],
    [undefined, null],
    ['', null],
    ['PENDING', '502'],
    ['FAILED', '9'],
  ])('rejects unknown or inconsistent input: %s / %s', (status, receipt) => {
    expect(paymentFlowSteps(status, receipt)).toBeNull()
  })

  it('never reads provider redirect values', () => {
    // A return URL might claim success; the mapping only sees the server status.
    expect(states(paymentFlowSteps('PENDING', undefined))).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ])
  })
})

describe('flowOutcome / flowProgress boundaries', () => {
  it('treats an empty list as active with 0 %', () => {
    expect(flowOutcome([])).toBe('active')
    expect(flowProgress([])).toBe(0)
  })

  it('does not count skipped steps as done', () => {
    const steps = upfrontLifecycle('RECEIVED_SEPARATELY')!
    expect(flowProgress(steps)).toBe(67)
    expect(flowOutcome(steps)).toBe('active')
  })
})

describe('documentLifecycle', () => {
  const doc = (
    status: string,
    reservedAmount?: string,
    latestAttemptState: string | null = null,
  ) => ({ status, reservedAmount, latestAttemptState })

  it.each(['receipt', 'credit'] as const)(
    'maps %s DRAFT → POSTED and CANCELLED',
    (variant) => {
      expect(states(documentLifecycle(variant, doc('DRAFT')))).toEqual([
        'done',
        'current',
        'upcoming',
      ])
      expect(states(documentLifecycle(variant, doc('POSTED')))).toEqual([
        'done',
        'done',
        'done',
      ])
      const cancelled = documentLifecycle(variant, doc('CANCELLED'))
      expect(states(cancelled)).toEqual(['done', 'failed', 'skipped'])
      expect(cancelled[1]?.hint).toBe('Phiếu bị hủy')
      expect(documentLifecycle(variant, doc('PENDING'))[1]?.hint).toBe(
        'Đang xử lý',
      )
    },
  )

  it('labels a credit application as an offset, not a cash posting', () => {
    expect(
      documentLifecycle('credit', doc('DRAFT')).map((step) => step.label),
    ).toEqual(['Lập nháp', 'Bù trừ dư có', 'Công nợ giảm'])
  })

  it('follows refund reservation and payout attempts', () => {
    expect(states(documentLifecycle('refund', doc('DRAFT', '0')))).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ])
    expect(states(documentLifecycle('refund', doc('DRAFT', '50000')))).toEqual([
      'done',
      'done',
      'current',
      'upcoming',
    ])
    const unknown = documentLifecycle(
      'refund',
      doc('DRAFT', '50000', 'UNKNOWN'),
    )
    expect(unknown[2]?.hint).toBe('Chờ cổng xác nhận')
    const failed = documentLifecycle('refund', doc('DRAFT', '50000', 'FAILED'))
    expect(states(failed)).toEqual(['done', 'done', 'failed', 'upcoming'])
    expect(states(documentLifecycle('refund', doc('POSTED', '0')))).toEqual([
      'done',
      'done',
      'done',
      'done',
    ])
    expect(
      states(documentLifecycle('refund', doc('CANCELLED', '50000'))),
    ).toEqual(['done', 'failed', 'skipped', 'skipped'])
  })

  it('treats a missing reservation as not reserved', () => {
    expect(states(documentLifecycle('refund', doc('DRAFT')))).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ])
  })
})

describe('upfrontLifecycle', () => {
  it('maps VERIFIED, CONSUMED and RECEIVED_SEPARATELY', () => {
    expect(states(upfrontLifecycle('VERIFIED'))).toEqual([
      'done',
      'current',
      'upcoming',
    ])
    expect(states(upfrontLifecycle('CONSUMED'))).toEqual([
      'done',
      'done',
      'done',
    ])
    expect(states(upfrontLifecycle('RECEIVED_SEPARATELY'))).toEqual([
      'done',
      'skipped',
      'done',
    ])
  })

  it.each(['verified', 'PENDING', null, 3])('rejects %s', (state) => {
    expect(upfrontLifecycle(state)).toBeNull()
  })
})

describe('groupTotals', () => {
  const rows = [
    { status: 'PENDING', amount: '300000' },
    { status: 'SUCCESS', amount: '500000' },
    { status: 'PENDING', amount: '200000' },
    { status: 'BOGUS', amount: '999' },
    { status: 'FAILED', amount: null },
  ]

  it('counts and sums known keys in the given order', () => {
    expect(
      groupTotals(rows, 'status', 'amount', [
        'PENDING',
        'SUCCESS',
        'FAILED',
        'EXPIRED',
      ]),
    ).toEqual([
      { key: 'PENDING', count: 2, amount: 500000 },
      { key: 'SUCCESS', count: 1, amount: 500000 },
      { key: 'FAILED', count: 1, amount: 0 },
    ])
  })

  it('returns nothing for empty input or unknown keys', () => {
    expect(groupTotals([], 'status', 'amount', ['PENDING'])).toEqual([])
    expect(groupTotals(rows, 'status', 'amount', ['EXPIRED'])).toEqual([])
  })
})

describe('limitUsage / usageBuckets', () => {
  it('computes debt over limit', () => {
    expect(limitUsage('15000000', '50000000')).toBe(0.3)
    expect(limitUsage('50000000', '50000000')).toBe(1)
  })

  it.each([
    ['100', '0'],
    ['100', undefined],
    [undefined, '100'],
    ['100', 100],
  ])('returns null without a usable limit: %s / %s', (debt, limit) => {
    expect(limitUsage(debt, limit)).toBeNull()
  })

  it('buckets agencies at the 50/80/100 % boundaries', () => {
    const rows = [
      ['49', '100'],
      ['50', '100'],
      ['79', '100'],
      ['80', '100'],
      ['99', '100'],
      ['100', '100'],
      ['150', '100'],
      ['10', '0'],
      ['10', null],
    ].map(([currentDebt, maxDebt]) => ({ currentDebt, maxDebt }))
    expect(
      usageBuckets(rows).map((bucket) => [bucket.key, bucket.count]),
    ).toEqual([
      ['low', 1],
      ['mid', 2],
      ['high', 2],
      ['over', 2],
      ['none', 2],
    ])
    expect(usageBuckets([]).every((bucket) => bucket.count === 0)).toBe(true)
  })
})
