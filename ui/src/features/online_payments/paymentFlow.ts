import type { FlowState, FlowStep } from '../payment_receipts/flow'
import { t } from '@/lib/i18n/core'
import { formatVND } from '@/lib/formatters'
import { paymentLimit } from '../stock_receipts/lineEstimates'

const AMOUNT = /^[1-9][0-9]{0,17}$/

export const PAYMENT_FLOW_LABELS = [
  ['create', t('Tạo giao dịch')],
  ['pay', t('Đại lý thanh toán trên VNPAY')],
  ['ipn', t('Cổng xác nhận (IPN)')],
  ['receipt', t('Phiếu thu ghi nhận')],
] as const

function steps(
  states: readonly FlowState[],
  hints: Partial<Record<number, string>> = {},
): FlowStep[] {
  return PAYMENT_FLOW_LABELS.map(([key, label], index) => ({
    key,
    label,
    state: states[index]!,
    ...(hints[index] ? { hint: hints[index] } : {}),
  }))
}

/**
 * VNPAY flow position derived ONLY from the server payment status and its
 * receipt link. Provider redirect/return parameters are never an input.
 * Returns `null` for an unknown status or an inconsistent receipt link.
 */
export function paymentFlowSteps(
  status: unknown,
  receiptDocumentId: unknown,
): FlowStep[] | null {
  const hasReceipt =
    typeof receiptDocumentId === 'string' && receiptDocumentId !== ''
  if (status !== 'SUCCESS' && receiptDocumentId != null) return null
  switch (status) {
    case 'PENDING':
      return steps(['done', 'current', 'upcoming', 'upcoming'], {
        1: t('Chờ đại lý trả tiền'),
      })
    case 'SUCCESS':
      return hasReceipt
        ? steps(['done', 'done', 'done', 'done'])
        : steps(['done', 'done', 'done', 'current'], {
            3: t('Đang lập phiếu thu'),
          })
    case 'FAILED':
      return steps(['done', 'done', 'failed', 'skipped'], {
        2: t('Cổng báo không thành công'),
      })
    case 'EXPIRED':
      return steps(['done', 'expired', 'skipped', 'skipped'], {
        1: t('Liên kết đã quá hạn'),
      })
    default:
      return null
  }
}

/**
 * Client-side admission of an online payment amount: a positive whole-VND
 * amount not above the agency's current debt (the server re-checks with
 * PAYMENT_EXCEEDS_DEBT). Returns the error text or null when admissible.
 */
export function onlineAmountError(amount: string, debt: string | null) {
  if (!AMOUNT.test(amount)) return t('Số tiền phải là số nguyên VND dương.')
  const limit = paymentLimit(debt)
  if (limit === null) return t('Chưa đọc được công nợ hiện tại của đại lý.')
  if (limit <= 0n) return t('Đại lý hiện không còn nợ để thanh toán.')
  if (BigInt(amount) > limit)
    return t('Số tiền vượt công nợ hiện tại ({debt}).', {
      debt: formatVND(limit.toString()),
    })
  return null
}
