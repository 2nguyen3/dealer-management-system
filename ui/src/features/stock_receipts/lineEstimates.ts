import type {
  DocumentLine,
  GoodsKind,
  LineInput,
} from '../document_history/documentContracts'
import {
  lineAmount,
  quantitySign,
  sumAmounts,
} from '../document_history/lineMath'

export const emptyLine = (): LineInput => ({
  productId: '',
  originLineId: '',
  quantity: '',
  unitPrice: '',
})

/** Whether the editor can estimate money for this kind (display only). */
export function canEstimate(
  kind: GoodsKind,
  originLines?: DocumentLine[] | null,
): boolean {
  return kind === 'STOCK_RECEIPT' || (kind === 'SALES_RETURN' && !!originLines)
}

/**
 * Estimated line amount: receipts use the entered purchase price; returns use
 * the original issue line's price. Issue prices are derived by the server.
 */
export function estimateLine(
  kind: GoodsKind,
  line: LineInput,
  originLines?: DocumentLine[] | null,
): bigint | null {
  if (kind === 'STOCK_RECEIPT') return lineAmount(line.quantity, line.unitPrice)
  if (kind === 'SALES_RETURN' && originLines) {
    const origin = originLines.find((item) => item.id === line.originLineId)
    return origin ? lineAmount(line.quantity, origin.unitPrice) : null
  }
  return null
}

export interface EditorSummary {
  lineCount: number
  /** Lines whose amount could be estimated. */
  pricedLines: number
  subtotal: bigint
  increases: number
  decreases: number
}

export function summarizeLines(
  kind: GoodsKind,
  lines: LineInput[],
  originLines?: DocumentLine[] | null,
): EditorSummary {
  const amounts = lines.map((line) => estimateLine(kind, line, originLines))
  const signs = lines.map((line) => quantitySign(line.quantity))
  return {
    lineCount: lines.length,
    pricedLines: amounts.filter((value) => value !== null).length,
    subtotal: sumAmounts(amounts),
    increases: signs.filter((sign) => sign === 1).length,
    decreases: signs.filter((sign) => sign === -1).length,
  }
}
