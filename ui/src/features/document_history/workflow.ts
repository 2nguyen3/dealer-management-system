import type { NextAction } from '@/components/guide/NextActionCallout'
import type { NextStep } from '@/components/guide/notifyNextStep'
import type { WorkflowStep } from '@/components/guide/WorkflowSteps'
import { formatVND } from '@/lib/formatters'
import { t } from '@/lib/i18n/core'
import {
  documentKinds,
  receiptAmountAfterIssue,
  receiptFormLink,
  type DocumentDetail,
  type DocumentKind,
} from './documentContracts'

/**
 * Pure "server state → process position" models of the three document kinds
 * (handoff §3.1, A2). They read only server data and grants; the server
 * stays the authority for every transition.
 */
const ROLE: Record<DocumentKind, { prepare: string; post: string }> = {
  STOCK_RECEIPT: { prepare: t('Kho'), post: t('Kho') },
  STOCK_ISSUE: { prepare: t('Kinh doanh'), post: t('Kho') },
  PAYMENT_RECEIPT: { prepare: t('Kế toán'), post: t('Kế toán') },
}
const ACCOUNTING = t('Kế toán')

/** Effect of posting, one sentence per kind. */
export function postEffect(kind: DocumentKind): string {
  switch (kind) {
    case 'STOCK_RECEIPT':
      return t('Tồn kho tăng và giá nhập gần nhất của mặt hàng được cập nhật.')
    case 'STOCK_ISSUE':
      return t(
        'Đơn giá xuất được chốt, tồn kho giảm và công nợ đại lý tăng bằng tổng tiền.',
      )
    case 'PAYMENT_RECEIPT':
      return t('Công nợ đại lý giảm bằng số tiền thu.')
  }
}

/** Effect of cancelling a posted document (the posting is reversed). */
export function cancelEffect(kind: DocumentKind): string {
  switch (kind) {
    case 'STOCK_RECEIPT':
      return t(
        'Tồn kho giảm lại; nếu hàng đã xuất thì không hủy được (thiếu tồn).',
      )
    case 'STOCK_ISSUE':
      return t('Hàng được nhập lại kho và công nợ đại lý giảm bằng tổng tiền.')
    case 'PAYMENT_RECEIPT':
      return t(
        'Công nợ đại lý tăng lại bằng số tiền thu và có thể vượt nợ tối đa (được phép vì là sửa sai).',
      )
  }
}

export interface WorkflowGrants {
  prepare: boolean
  post: boolean
  /** May prepare a payment receipt (the step after posting an issue). */
  collect: boolean
}

export function documentSteps(
  doc: Pick<DocumentDetail, 'kind' | 'status'>,
  grants: WorkflowGrants,
): WorkflowStep[] {
  const role = ROLE[doc.kind]
  const draft = doc.status === 'DRAFT'
  const cancelled = doc.status === 'CANCELLED'
  const steps: WorkflowStep[] = [
    {
      key: 'draft',
      label: t('Lập nháp'),
      role: role.prepare,
      state: draft ? 'current' : 'done',
      hint: t('Nháp sửa/xóa tự do, chưa ảnh hưởng tồn kho hay công nợ.'),
    },
    {
      key: 'post',
      label: t('Ghi sổ'),
      role: role.post,
      state: !draft ? 'done' : grants.post ? 'todo' : 'blocked',
      hint:
        draft && !grants.post
          ? t('Cần {role} có quyền ghi sổ.', { role: role.post })
          : postEffect(doc.kind),
    },
  ]
  if (doc.kind === 'STOCK_ISSUE')
    steps.push({
      key: 'collect',
      label: t('Lập phiếu thu'),
      role: ACCOUNTING,
      state: cancelled ? 'skipped' : draft ? 'todo' : 'current',
      hint: t('Khi đại lý trả tiền, lập phiếu thu để giảm công nợ.'),
    })
  if (cancelled)
    steps.push({
      key: 'cancelled',
      label: t('Đã hủy'),
      state: 'done',
      hint: cancelEffect(doc.kind),
    })
  return steps
}

/** "Việc cần làm tiếp" of a document detail, or null when nothing is due. */
export function documentNext(
  doc: Pick<
    DocumentDetail,
    'kind' | 'status' | 'agencyId' | 'totalAmount' | 'agencyDebt' | 'code'
  >,
  grants: WorkflowGrants,
): NextAction | null {
  const role = ROLE[doc.kind]
  if (doc.status === 'DRAFT')
    return grants.post
      ? {
          title: t('Kiểm tra rồi ghi sổ'),
          description: postEffect(doc.kind),
        }
      : {
          title: t('Chờ ghi sổ'),
          description: postEffect(doc.kind),
          waitingFor: role.post,
        }
  if (doc.status === 'POSTED' && doc.kind === 'STOCK_ISSUE' && doc.agencyId) {
    const amount = receiptAmountAfterIssue(doc.totalAmount, doc.agencyDebt)
    if (amount === null) return null
    return grants.collect
      ? {
          title: t('Thu tiền đại lý'),
          description: t(
            'Khi đại lý trả tiền cho {code}, lập phiếu thu {amount}.',
            { code: doc.code, amount: formatVND(amount) },
          ),
          to: receiptFormLink(doc.agencyId, amount),
          actionLabel: t('Lập phiếu thu'),
        }
      : {
          title: t('Thu tiền đại lý'),
          description: t('Kế toán lập phiếu thu khi đại lý trả tiền.'),
          waitingFor: ACCOUNTING,
        }
  }
  return null
}

/** Toast after a mutation: what happened and what comes next. */
export function documentNotice(
  action: 'create' | 'update' | 'delete' | 'post' | 'cancel' | 'correct',
  kind: DocumentKind,
  code: string,
): NextStep {
  const title = documentKinds[kind].title
  switch (action) {
    case 'create':
    case 'update':
      return {
        done: t('Đã lưu nháp {code}.', { code }),
        next: t('Bước tiếp: mở phiếu, kiểm tra rồi bấm Ghi sổ.'),
      }
    case 'delete':
      return { done: t('Đã xóa nháp {code}.', { code }) }
    case 'post':
      return {
        done: t('Đã ghi sổ {code}.', { code }),
        next:
          kind === 'STOCK_ISSUE'
            ? t(
                'Tồn kho đã giảm và công nợ đại lý đã tăng. Lập phiếu thu khi đại lý trả tiền.',
              )
            : postEffect(kind),
      }
    case 'cancel':
      return {
        done: t('Đã hủy {code}.', { code }),
        next: cancelEffect(kind),
      }
    case 'correct':
      return {
        done: t('Đã lập {code} thay thế.', { code }),
        next: t(
          '{title} cũ đã được hủy; tồn kho và công nợ tính theo phiếu mới.',
          {
            title,
          },
        ),
      }
  }
}
