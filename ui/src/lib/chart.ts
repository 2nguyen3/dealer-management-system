/**
 * Shared chart helpers. Categorical colours are the validated eight-slot
 * palette exposed as `--chart-1..8`; assign them in fixed order to a stable
 * entity key (never by rank) and fold a ninth series into "Khác".
 */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const

export const CHART_GRID = 'var(--chart-grid)'
export const CHART_AXIS = 'var(--chart-axis)'

/** Colour for slot `index` (0-based); slots past eight reuse the muted ink. */
export function chartColor(index: number): string {
  return CHART_COLORS[index] ?? 'var(--muted-foreground)'
}

/** Parses a backend decimal string without throwing; NaN becomes 0. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const COMPACT = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const PLAIN = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const PERCENT = new Intl.NumberFormat('vi-VN', {
  style: 'percent',
  maximumFractionDigits: 1,
})

/** Axis/tick label: 1,2 Tr, 350 N … */
export function formatCompact(value: number): string {
  return COMPACT.format(value)
}

/** Compact money for KPI tiles: "1,2 Tr ₫". */
export function formatCompactVND(value: number): string {
  return `${COMPACT.format(value)} ₫`
}

export function formatPlain(value: number): string {
  return PLAIN.format(value)
}

export function formatPercent(ratio: number): string {
  return PERCENT.format(ratio)
}

/**
 * Relative change between two periods. Returns null when the previous value is
 * zero (a percentage would be meaningless).
 */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}
