import {
  exact,
  isZero,
  object,
  validId,
} from '../document_history/documentContracts'
import { t } from '@/lib/i18n/core'

export interface CountLine {
  id: string
  productId: string
  productCode: string
  productName: string
  unitName: string
  bookQuantity: string
  countedQuantity: string
  difference: string
}
export interface StockCount {
  id: string
  code: string
  state: 'DRAFT' | 'CONFIRMED'
  countedAt: string
  reason: string | null
  adjustmentDocumentId: string | null
  lines: CountLine[]
}
export function validInstant(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) && !Number.isNaN(Date.parse(value))
  )
}
export function parseCount(value: unknown): StockCount {
  const row = object(value)
  if (
    !validId(row.id) ||
    typeof row.code !== 'string' ||
    !['DRAFT', 'CONFIRMED'].includes(String(row.state)) ||
    typeof row.countedAt !== 'string' ||
    !validInstant(row.countedAt) ||
    !Array.isArray(row.lines)
  )
    throw new Error(t('Biên bản kiểm kê không hợp lệ.'))
  const lines = row.lines.map((value) => {
    const line = object(value)
    if (
      !validId(line.id) ||
      !validId(line.productId) ||
      typeof line.productName !== 'string' ||
      typeof line.productCode !== 'string' ||
      typeof line.unitName !== 'string' ||
      typeof line.bookQuantity !== 'string' ||
      !exact.quantity.test(line.bookQuantity) ||
      typeof line.countedQuantity !== 'string' ||
      !exact.quantity.test(line.countedQuantity) ||
      typeof line.difference !== 'string' ||
      !exact.signedQuantity.test(line.difference)
    )
      throw new Error(t('Dòng kiểm kê không hợp lệ.'))
    return line as unknown as CountLine
  })
  return { ...row, lines } as unknown as StockCount
}
export function canConfirmCount(
  count: StockCount,
  canCount: boolean,
  canPost: boolean,
) {
  return (
    canCount &&
    count.state === 'DRAFT' &&
    count.lines.length > 0 &&
    (canPost || count.lines.every((line) => isZero(line.difference)))
  )
}
