import { rowsOf } from '../../components/ui/pickerItems'
import { lineAmount, scaledQuantity } from '../document_history/lineMath'

export interface StockRow {
  id: string
  code: string
  name: string
  unitName: string
  currentStock: string
  /** Low-stock threshold as an exact quantity string, when provided. */
  threshold: string | null
  /** currentStock × currentPurchasePrice in whole VND, when a price exists. */
  stockValue: bigint | null
  low: boolean
}

function text(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : null
}

/**
 * Low-stock flag for display only. The server flag wins when present; the
 * Number() comparison never feeds a request or a displayed quantity.
 */
function isLowStock(row: Record<string, unknown>): boolean {
  if (typeof row.isLowStock === 'boolean') return row.isLowStock
  const stock = Number(text(row.currentStock))
  const threshold = Number(
    text(row.lowStockThreshold) ?? text(row.minStockAlert) ?? Number.NaN,
  )
  return Number.isFinite(stock) && Number.isFinite(threshold)
    ? stock < threshold
    : false
}

/** Keeps only well-formed product rows; quantities stay exact strings. */
export function parseStockRows(data: unknown): StockRow[] {
  return rowsOf(data).flatMap((value) => {
    if (typeof value !== 'object' || value === null) return []
    const row = value as Record<string, unknown>
    const rowId = text(row.id)
    const code = text(row.code)
    const name = text(row.name)
    const stock = text(row.currentStock)
    if (!rowId || !code || !name || stock === null) return []
    const price = text(row.currentPurchasePrice)
    return [
      {
        id: rowId,
        code,
        name,
        unitName: text(row.unitName) ?? '',
        currentStock: stock,
        threshold: text(row.lowStockThreshold) ?? text(row.minStockAlert),
        stockValue: price === null ? null : lineAmount(stock, price),
        low: isLowStock(row),
      },
    ]
  })
}

/**
 * Stock level relative to the low-stock threshold, as a 0–100 bar where the
 * threshold sits at 50 %. Null when there is no usable threshold.
 */
export function stockLevel(row: StockRow): number | null {
  if (row.threshold === null) return null
  const stock = scaledQuantity(row.currentStock)
  const threshold = scaledQuantity(row.threshold)
  if (stock === null || threshold === null || threshold <= 0n) return null
  if (stock <= 0n) return 0
  const percent = Number((stock * 50n) / threshold)
  return Math.min(100, Math.max(1, percent))
}

/** Total stock value across rows that have a price; null when none do. */
export function totalStockValue(rows: StockRow[]): bigint | null {
  const priced = rows.filter((row) => row.stockValue !== null)
  if (!priced.length) return null
  return priced.reduce((sum, row) => sum + (row.stockValue ?? 0n), 0n)
}
