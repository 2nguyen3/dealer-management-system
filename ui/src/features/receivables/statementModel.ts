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
