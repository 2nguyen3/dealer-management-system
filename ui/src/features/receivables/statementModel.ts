import { toNumber } from '@/lib/chart'
import { formatDate } from '@/lib/formatters'
import type { Row } from '../payment_receipts/contracts'

export interface BalancePoint {
  key: string
  date: string
  code: string
  balance: number
  raw: string
}

/** Running-balance series from effective statement entries, in list order. */
export function balanceSeries(items: Row[]): BalancePoint[] {
  return items
    .filter((item) => item.isEffective === true)
    .map((item) => ({
      key: String(item.id),
      date: formatDate(String(item.businessDate)),
      code: String(item.sourceDocumentCode),
      balance: toNumber(String(item.balanceAfter)),
      raw: String(item.balanceAfter),
    }))
}

export type AgingBucket = {
  key: string
  label: string
  amount: number
  count: number
}

/**
 * Groups outstanding invoice balances by age (days since business date) as of
 * `today` (YYYY-MM-DD). Invoices with nothing outstanding are skipped.
 */
export function agingBuckets(
  invoices: { businessDate: string; outstanding: string }[],
  today: string,
): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { key: '0-30', label: '0–30 ngày', amount: 0, count: 0 },
    { key: '31-60', label: '31–60 ngày', amount: 0, count: 0 },
    { key: '61-90', label: '61–90 ngày', amount: 0, count: 0 },
    { key: '90+', label: 'Trên 90 ngày', amount: 0, count: 0 },
  ]
  const now = Date.parse(`${today}T00:00:00Z`)
  for (const invoice of invoices) {
    const value = toNumber(invoice.outstanding)
    if (value <= 0) continue
    const days = Math.max(
      0,
      Math.floor(
        (now - Date.parse(`${invoice.businessDate}T00:00:00Z`)) / 86400000,
      ),
    )
    const bucket =
      buckets[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3]!
    bucket.amount += value
    bucket.count += 1
  }
  return buckets
}

/** Debt / limit ratio, or null when the limit is missing, invalid or zero. */
export function limitUsage(
  currentDebt: unknown,
  maxDebt: unknown,
): number | null {
  if (typeof maxDebt !== 'string' || typeof currentDebt !== 'string')
    return null
  const limit = toNumber(maxDebt)
  return limit > 0 ? toNumber(currentDebt) / limit : null
}

export type UsageBucket = { key: string; label: string; count: number }

/**
 * Agencies grouped by credit-limit usage: < 50 %, 50–80 %, 80–100 %, ≥ 100 %
 * (over the limit) and "no limit" when the limit is missing or zero.
 */
export function usageBuckets(
  rows: { currentDebt: unknown; maxDebt: unknown }[],
): UsageBucket[] {
  const buckets: UsageBucket[] = [
    { key: 'low', label: 'Dưới 50%', count: 0 },
    { key: 'mid', label: '50–80%', count: 0 },
    { key: 'high', label: '80–100%', count: 0 },
    { key: 'over', label: 'Vượt hạn mức', count: 0 },
    { key: 'none', label: 'Không giới hạn', count: 0 },
  ]
  for (const row of rows) {
    const usage = limitUsage(row.currentDebt, row.maxDebt)
    const index =
      usage === null ? 4 : usage < 0.5 ? 0 : usage < 0.8 ? 1 : usage < 1 ? 2 : 3
    buckets[index]!.count += 1
  }
  return buckets
}
