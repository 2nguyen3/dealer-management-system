import type {
  GoodsKind,
  LineInput,
} from '../document_history/documentContracts'
import { formatQuantity } from '../../lib/formatters'
import {
  lineAmount,
  scaledQuantity,
  sumAmounts,
} from '../document_history/lineMath'
import type { ProductQuote } from '../document_history/useRecords'
import { t } from '@/lib/i18n/core'

/**
 * Unit price used for a display estimate: receipts use the entered purchase
 * price; issue prices are quoted by the server from the product's selling
 * price (QĐ2), so the current `sellingPrice` is only a preview.
 */
export function estimatePrice(
  kind: GoodsKind,
  line: LineInput,
  quotes: Record<string, ProductQuote> = {},
): string | null {
  if (kind === 'STOCK_RECEIPT') return line.unitPrice.trim() || null
  return quotes[line.productId]?.sellingPrice ?? null
}

/** Estimated line amount (whole VND), or null when it cannot be estimated. */
export function estimateLine(
  kind: GoodsKind,
  line: LineInput,
  quotes: Record<string, ProductQuote> = {},
): bigint | null {
  const price = estimatePrice(kind, line, quotes)
  return price === null ? null : lineAmount(line.quantity, price)
}

export interface EditorSummary {
  lineCount: number
  /** Lines whose amount could be estimated. */
  pricedLines: number
  subtotal: bigint
}

export function summarizeLines(
  kind: GoodsKind,
  lines: LineInput[],
  quotes: Record<string, ProductQuote> = {},
): EditorSummary {
  const amounts = lines.map((line) => estimateLine(kind, line, quotes))
  return {
    lineCount: lines.length,
    pricedLines: amounts.filter((value) => value !== null).length,
    subtotal: sumAmounts(amounts),
  }
}

/** Debt after adding `amount` to `debt` (exact, both whole VND strings). */
export function debtAfter(debt: string, amount: bigint): bigint {
  return BigInt(debt) + amount
}

/** Stock/pricing warning of an issue line, or null when it looks fine. */
export function issueLineWarning(
  line: LineInput,
  quote: ProductQuote | undefined,
): string | null {
  if (!quote) return null
  if (quote.sellingPrice === null)
    return t('Mặt hàng chưa từng nhập nên chưa có giá bán, chưa xuất được.')
  const wanted = scaledQuantity(line.quantity)
  const stock = scaledQuantity(quote.stock)
  if (wanted !== null && stock !== null && wanted > stock)
    return t('Vượt tồn hiện tại ({stock} {unitName}).', {
      stock: formatQuantity(quote.stock),
      unitName: quote.unitName,
    })
  return null
}

/**
 * Most a manual payment receipt may collect (QĐ4): the agency's current
 * debt, plus the amount of the receipt a correction cancels first. Null
 * while the debt is unknown.
 */
export function paymentLimit(
  debt: string | null | undefined,
  reversed: bigint = 0n,
): bigint | null {
  if (debt === null || debt === undefined || !/^-?(0|[1-9][0-9]*)$/.test(debt))
    return null
  return BigInt(debt) + reversed
}
