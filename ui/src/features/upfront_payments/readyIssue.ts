import { decimal, id, record, text } from '../payment_receipts/contracts'
import { t } from '@/lib/i18n/core'

export interface ReadyIssue {
  documentId: string
  code: string
  agencyName: string | null
  revisionId: string
  revisionNo: string
  revisionState: string
  immediatePayment: string
  /** Why this issue cannot receive an upfront verification, if any. */
  problem: string | null
}

/**
 * Decodes `GET /stock-issues/{id}` into the current revision that an upfront
 * verification must target (backend: PENDING document, READY current revision,
 * amount equal to its immediate payment, no existing confirmation).
 */
export function readyIssue(value: unknown): ReadyIssue {
  const data = record(value)
  const revision = record(data.currentRevision)
  const snapshot =
    revision.agencySnapshot && typeof revision.agencySnapshot === 'object'
      ? record(revision.agencySnapshot)
      : null
  const issue: ReadyIssue = {
    documentId: id(data.id),
    code: text(data.code),
    agencyName:
      typeof data.agencyName === 'string'
        ? data.agencyName
        : typeof snapshot?.name === 'string'
          ? snapshot.name
          : null,
    revisionId: id(revision.id),
    revisionNo: String(revision.revisionNo ?? ''),
    revisionState: text(revision.state),
    immediatePayment: decimal(revision.immediatePayment),
    problem: null,
  }
  if (data.status !== 'PENDING' || issue.revisionState !== 'READY')
    issue.problem = t(
      'Phiếu xuất chưa ở trạng thái Sẵn sàng (chờ ghi sổ), chưa thể xác minh tiền trả ngay.',
    )
  else if (
    data.upfrontConfirmationId !== null &&
    data.upfrontConfirmationId !== undefined
  )
    issue.problem = t('Phiếu xuất này đã có khoản thực nhận được xác minh.')
  else if (/^0(\.0+)?$/.test(issue.immediatePayment))
    issue.problem = t('Phiếu xuất không có khoản trả ngay cần xác minh.')
  return issue
}
