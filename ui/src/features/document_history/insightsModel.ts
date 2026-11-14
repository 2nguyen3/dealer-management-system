import { BookCheck, FilePen, Undo2, XCircle } from 'lucide-react'
import { toNumber } from '../../lib/chart'
import { formatDate } from '../../lib/formatters'
import { statusLabel } from '../../lib/labels'
import type { DocumentSummary } from './documentContracts'
import type { LifecycleStep } from './DocumentParts'
import { t } from '@/lib/i18n/core'

const STATUS_ORDER = ['DRAFT', 'POSTED', 'CANCELLED'] as const
const STATUS_COLORS: Record<(typeof STATUS_ORDER)[number], string> = {
  DRAFT: 'var(--chart-4)',
  POSTED: 'var(--success)',
  CANCELLED: 'var(--destructive)',
}

/** Exact page total from decimal strings (whole VND), as a bigint. */
export function pageTotal(items: readonly DocumentSummary[]): bigint {
  return items.reduce((sum, row) => {
    try {
      return sum + BigInt(row.totalAmount)
    } catch {
      return sum
    }
  }, 0n)
}

/** Status counts in lifecycle order, skipping empty statuses. */
export function statusParts(items: readonly DocumentSummary[]) {
  return STATUS_ORDER.map((status) => ({
    key: status,
    label: statusLabel(status),
    value: items.filter((row) => row.status === status).length,
    color: STATUS_COLORS[status],
  })).filter((part) => part.value > 0)
}

/** Sum of document totals per business date, oldest first. */
export function valueByDay(items: readonly DocumentSummary[]) {
  const days = new Map<string, bigint>()
  for (const row of items) {
    let amount = 0n
    try {
      amount = BigInt(row.totalAmount)
    } catch {
      amount = 0n
    }
    days.set(row.businessDate, (days.get(row.businessDate) ?? 0n) + amount)
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, amount]) => ({
      day,
      label: formatDate(day).slice(0, 5),
      value: toNumber(amount.toString()),
      exact: amount.toString(),
    }))
}

const DRAFT: LifecycleStep = {
  key: 'draft',
  label: t('Lập phiếu'),
  icon: FilePen,
  hint: t('Bản nháp: còn sửa được, chưa tác động sổ sách.'),
}
const POSTED: LifecycleStep = {
  key: 'posted',
  label: t('Ghi sổ'),
  icon: BookCheck,
  hint: t('Đã ghi vào sổ: tồn kho và công nợ đã cập nhật.'),
}
const CHANGE: LifecycleStep = {
  key: 'change',
  label: t('Hủy/Sửa có lý do'),
  icon: Undo2,
  hint: t(
    'Chỉ trong tháng hiện tại, bắt buộc lý do; sửa sẽ hủy phiếu cũ và lập phiếu thay thế.',
  ),
}
const CANCELLED: LifecycleStep = {
  key: 'cancelled',
  label: t('Hủy'),
  icon: XCircle,
  hint: t('Chứng từ đã hủy; tác động sổ sách được đảo lại.'),
}

/** Draft → posted → cancelled/corrected; the same rail for every kind. */
export function lifecycleSteps(status: DocumentSummary['status']): {
  steps: LifecycleStep[]
  current: number
} {
  const main = [DRAFT, POSTED]
  if (status === 'CANCELLED') return { steps: [...main, CANCELLED], current: 2 }
  return { steps: [...main, CHANGE], current: status === 'POSTED' ? 1 : 0 }
}

/** Replacement marker shown next to the status of a corrected document. */
export function replacementSuffix(row: DocumentSummary): string | undefined {
  if (row.replacedByDocumentId) return t('đã thay thế')
  if (row.replacesDocumentId) return t('phiếu thay thế')
  return undefined
}
