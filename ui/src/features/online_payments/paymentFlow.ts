import type { FlowState, FlowStep } from '../payment_receipts/flow'

export const PAYMENT_FLOW_LABELS = [
  ['create', 'Tạo giao dịch'],
  ['pay', 'Đại lý thanh toán trên VNPAY'],
  ['ipn', 'Cổng xác nhận (IPN)'],
  ['receipt', 'Phiếu thu ghi nhận'],
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
        1: 'Chờ đại lý trả tiền',
      })
    case 'SUCCESS':
      return hasReceipt
        ? steps(['done', 'done', 'done', 'done'])
        : steps(['done', 'done', 'done', 'current'], {
            3: 'Đang lập phiếu thu',
          })
    case 'FAILED':
      return steps(['done', 'done', 'failed', 'skipped'], {
        2: 'Cổng báo không thành công',
      })
    case 'EXPIRED':
      return steps(['done', 'expired', 'skipped', 'skipped'], {
        1: 'Liên kết đã quá hạn',
      })
    default:
      return null
  }
}
