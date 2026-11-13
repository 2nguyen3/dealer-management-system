import type { PartDatum } from '@/components/charts/MebiusCharts'
import { toNumber } from '@/lib/chart'

/** Display-only number of a server value (exact strings stay untouched elsewhere). */
export function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') return toNumber(value)
  return 0
}

export function sumBy<T>(items: readonly T[], value: (item: T) => number) {
  return items.reduce((total, item) => total + value(item), 0)
}

export function countWhere<T>(
  items: readonly T[],
  test: (item: T) => boolean,
): number {
  return items.reduce((total, item) => total + (test(item) ? 1 : 0), 0)
}

const MAX_PARTS = 8

/**
 * Groups rows into chart parts in a stable entity order (numeric key order,
 * never by size) so colours stay fixed; a ninth part onwards folds into "Khác".
 */
export function partsBy<T>(
  items: readonly T[],
  key: (item: T) => string | number | null | undefined,
  label: (item: T) => string,
  value: (item: T) => number = () => 1,
): PartDatum[] {
  const groups = new Map<
    string,
    { order: string; label: string; value: number }
  >()
  for (const item of items) {
    const raw = key(item)
    const order = raw === null || raw === undefined ? '' : String(raw)
    const current = groups.get(order)
    if (current) current.value += value(item)
    else groups.set(order, { order, label: label(item), value: value(item) })
  }
  const ordered = [...groups.values()].sort((a, b) =>
    a.order.localeCompare(b.order, 'vi', { numeric: true }),
  )
  const parts = ordered.map((group, index) => ({
    key: `p${index}`,
    label: group.label,
    value: group.value,
  }))
  if (parts.length <= MAX_PARTS) return parts
  const kept = parts.slice(0, MAX_PARTS - 1)
  const rest = parts.slice(MAX_PARTS - 1)
  return [
    ...kept,
    { key: 'other', label: 'Khác', value: sumBy(rest, (part) => part.value) },
  ]
}

/** 0–1 ratio that is safe for meters; 0 when the denominator is not positive. */
export function ratioOf(part: number, whole: number): number {
  if (!(whole > 0)) return 0
  return Math.max(0, Math.min(1, part / whole))
}
