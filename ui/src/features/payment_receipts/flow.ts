import { toNumber } from '@/lib/chart'
import type { FinancialDocument, Row } from './contracts'

/** Visual state of one lifecycle step. Derived only from server data. */
export type FlowState =
  'done' | 'current' | 'upcoming' | 'failed' | 'expired' | 'skipped'

export interface FlowStep {
  key: string
  label: string
  state: FlowState
  hint?: string
}

/** Overall outcome of a step list: still moving, finished, or stopped. */
export type FlowOutcome = 'active' | 'complete' | 'failed' | 'expired'

export function flowOutcome(steps: readonly FlowStep[]): FlowOutcome {
  if (steps.some((step) => step.state === 'failed')) return 'failed'
  if (steps.some((step) => step.state === 'expired')) return 'expired'
  if (steps.length > 0 && steps.every((step) => step.state === 'done'))
    return 'complete'
  return 'active'
}

/** Share of finished steps, 0–100 (skipped steps do not count as done). */
export function flowProgress(steps: readonly FlowStep[]): number {
  if (!steps.length) return 0
  const done = steps.filter((step) => step.state === 'done').length
  return Math.round((done / steps.length) * 100)
}

function build(
  labels: readonly (readonly [key: string, label: string])[],
  states: readonly FlowState[],
  hints: Partial<Record<number, string>> = {},
): FlowStep[] {
  return labels.map(([key, label], index) => ({
    key,
    label,
    state: states[index] ?? 'upcoming',
    ...(hints[index] ? { hint: hints[index] } : {}),
  }))
}

const SETTLED = ['done', 'done', 'done'] as const

/**
 * Draft → post lifecycle of a receipt, credit application or refund, derived
 * from the server document status (and, for refunds, reservation/attempt state).
 */
export function documentLifecycle(
  variant: 'receipt' | 'credit' | 'refund',
  item: Pick<
    FinancialDocument,
    'status' | 'reservedAmount' | 'latestAttemptState'
  >,
): FlowStep[] {
  const { status } = item
  if (variant === 'refund') {
    const labels = [
      ['draft', 'Lập yêu cầu'],
      ['reserve', 'Giữ chỗ quỹ'],
      ['payout', 'Chi tiền cho đại lý'],
      ['done', 'Hoàn tất'],
    ] as const
    if (status === 'POSTED')
      return build(labels, ['done', 'done', 'done', 'done'])
    if (status === 'CANCELLED')
      return build(labels, ['done', 'failed', 'skipped', 'skipped'], {
        1: 'Phiếu bị hủy',
      })
    const reserved =
      typeof item.reservedAmount === 'string' &&
      toNumber(item.reservedAmount) > 0
    if (!reserved && status === 'DRAFT')
      return build(labels, ['done', 'current', 'upcoming', 'upcoming'])
    const attempt = item.latestAttemptState
    if (attempt === 'FAILED')
      return build(labels, ['done', 'done', 'failed', 'upcoming'], {
        2: 'Lần hoàn trực tuyến thất bại',
      })
    return build(labels, ['done', 'done', 'current', 'upcoming'], {
      2:
        attempt === 'PENDING' || attempt === 'UNKNOWN'
          ? 'Chờ cổng xác nhận'
          : undefined,
    })
  }
  const labels =
    variant === 'credit'
      ? ([
          ['draft', 'Lập nháp'],
          ['post', 'Bù trừ dư có'],
          ['debt', 'Công nợ giảm'],
        ] as const)
      : ([
          ['draft', 'Lập nháp'],
          ['post', 'Ghi sổ'],
          ['debt', 'Công nợ cập nhật'],
        ] as const)
  if (status === 'POSTED') return build(labels, SETTLED)
  if (status === 'CANCELLED')
    return build(labels, ['done', 'failed', 'skipped'], { 1: 'Phiếu bị hủy' })
  return build(labels, ['done', 'current', 'upcoming'], {
    1: status === 'PENDING' ? 'Đang xử lý' : undefined,
  })
}

/**
 * Upfront confirmation lifecycle: verified cash waits for the stock issue to
 * post (→ receipt), or is received separately as its own receipt.
 * Returns `null` for a state the server contract does not define.
 */
export function upfrontLifecycle(state: unknown): FlowStep[] | null {
  const labels = [
    ['verify', 'Xác minh tiền'],
    ['issue', 'Phiếu xuất ghi sổ'],
    ['receipt', 'Lập phiếu thu'],
  ] as const
  if (state === 'VERIFIED')
    return build(labels, ['done', 'current', 'upcoming'])
  if (state === 'CONSUMED') return build(labels, SETTLED)
  if (state === 'RECEIVED_SEPARATELY')
    return build(labels, ['done', 'skipped', 'done'], {
      1: 'Thu riêng, không gắn phiếu xuất',
    })
  return null
}

export interface GroupTotal {
  key: string
  count: number
  amount: number
}

/**
 * Count and amount per key for the rows currently loaded, in `order`. Rows
 * whose key is not in `order` are ignored; empty groups are dropped.
 * Amounts are display-only approximations (numbers), never sent to the API.
 */
export function groupTotals(
  rows: readonly Row[],
  keyField: string,
  amountField: string,
  order: readonly string[],
): GroupTotal[] {
  const groups = new Map<string, GroupTotal>(
    order.map((key) => [key, { key, count: 0, amount: 0 }]),
  )
  for (const row of rows) {
    const group = groups.get(String(row[keyField]))
    if (!group) continue
    group.count += 1
    group.amount += toNumber(
      typeof row[amountField] === 'string' ? row[amountField] : 0,
    )
  }
  return [...groups.values()].filter((group) => group.count > 0)
}
