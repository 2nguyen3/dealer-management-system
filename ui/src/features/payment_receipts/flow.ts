import { toNumber } from '@/lib/chart'
import type { Row } from './contracts'

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
