import { describe, expect, it } from 'vitest'
import {
  onlineAmountError,
  paymentFlowSteps,
} from '../features/online_payments/paymentFlow'
import {
  flowOutcome,
  flowProgress,
  groupTotals,
  type FlowStep,
} from '../features/payment_receipts/flow'

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
    const steps: FlowStep[] = [
      { key: 'a', label: 'A', state: 'done' },
      { key: 'b', label: 'B', state: 'skipped' },
      { key: 'c', label: 'C', state: 'done' },
    ]
    expect(flowProgress(steps)).toBe(67)
    expect(flowOutcome(steps)).toBe('active')
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

describe('onlineAmountError (amount <= current debt)', () => {
  it('admits a positive whole amount up to the current debt', () => {
    expect(onlineAmountError('1', '1')).toBeNull()
    expect(onlineAmountError('500000', '1250000')).toBeNull()
    expect(onlineAmountError('1250000', '1250000')).toBeNull()
  })

  it('rejects an amount above the debt and names the debt', () => {
    const error = onlineAmountError('1250001', '1250000')
    expect(error).toMatch(/vượt công nợ hiện tại/)
    expect(error).toMatch(/1\.250\.000/)
  })

  it.each(['0', '-5', '1.5', '01', '', '1'.repeat(19), 'abc'])(
    'rejects malformed amount %s',
    (amount) => {
      expect(onlineAmountError(amount, '1000')).toMatch(/số nguyên VND dương/)
    },
  )

  it('rejects when the agency owes nothing or has prepaid', () => {
    expect(onlineAmountError('1', '0')).toMatch(/không còn nợ/)
    expect(onlineAmountError('1', '-200000')).toMatch(/không còn nợ/)
  })

  it.each([null, 'x', '1.5'])(
    'rejects an unread or invalid debt %s',
    (debt) => {
      expect(onlineAmountError('1', debt)).toMatch(/Chưa đọc được công nợ/)
    },
  )
})
