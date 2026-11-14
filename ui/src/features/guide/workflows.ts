import type { NextAction } from '@/components/guide/NextActionCallout'
import type { StepState, WorkflowStep } from '@/components/guide/WorkflowSteps'
import { formatQuantity } from '@/lib/formatters'
import { msg, t } from '@/lib/i18n/core'
import type { DocumentDetail } from '../document_history/documentContracts'

/**
 * Pure "server state → process position" models for the business workflows.
 * They read only server data and permissions; the server stays the authority
 * for every transition, so lock reasons are predictions with the server's
 * error translation as the final word.
 */

export const ROLES = {
  sales: msg('Kinh doanh'),
  accounting: msg('Kế toán'),
  warehouse: msg('Kho'),
  management: msg('Quản lý'),
  admin: msg('Quản trị hệ thống'),
} as const

function step(
  key: string,
  label: string,
  state: StepState,
  role?: string,
  hint?: string,
): WorkflowStep {
  return {
    key,
    label: t(label),
    state,
    ...(role ? { role: t(role) } : {}),
    ...(hint ? { hint } : {}),
  }
}

/** True for an exact positive integer money string. */
export function positiveMoney(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
}

/** Exact a − b for integer money strings; `null` when either is not exact. */
export function subtractMoney(a: string, b: string): string | null {
  if (!/^-?[0-9]+$/.test(a) || !/^-?[0-9]+$/.test(b)) return null
  return (BigInt(a) - BigInt(b)).toString()
}

export interface IssueAbilities {
  prepare: boolean
  post: boolean
  /** May prepare a payment receipt (the step after posting). */
  collect: boolean
}

export interface IssueWorkflow {
  steps: WorkflowStep[]
  next: NextAction | null
  /** Why "Ghi sổ" cannot succeed yet (null = predicted OK). */
  postLock: string | null
}

/**
 * Deep link that opens a new payment receipt for an agency
 * (`/payment-receipts?agency=<id>&new=1`); the plain list without an agency.
 */
export function collectLink(agencyId: string | null | undefined): string {
  return agencyId
    ? `/payment-receipts?agency=${encodeURIComponent(agencyId)}&new=1`
    : '/payment-receipts'
}

/**
 * Stock issue: Lập nháp → Ghi sổ xuất kho (price fixed at posting from the
 * latest purchase price × selling-price rate; stock and debt-limit checks)
 * → Lập phiếu thu when the agency pays. A posted issue changes only through
 * Hủy or Sửa có lý do.
 */
export function stockIssueWorkflow(
  doc: Pick<DocumentDetail, 'code' | 'status' | 'lines' | 'agencyId'>,
  can: IssueAbilities,
): IssueWorkflow {
  const draft = doc.status === 'DRAFT'
  const posted = doc.status === 'POSTED'
  const cancelled = doc.status === 'CANCELLED'
  const states: Record<'draft' | 'post' | 'collect', StepState> = cancelled
    ? { draft: 'done', post: 'skipped', collect: 'skipped' }
    : posted
      ? { draft: 'done', post: 'done', collect: 'current' }
      : { draft: 'current', post: 'todo', collect: 'todo' }

  const steps = [
    step(
      'draft',
      msg('Lập nháp'),
      states.draft,
      ROLES.sales,
      cancelled
        ? t('Phiếu đã hủy.')
        : t('Chọn đại lý, ngày và các dòng hàng (mặt hàng, số lượng).'),
    ),
    step(
      'post',
      msg('Ghi sổ xuất kho'),
      states.post,
      ROLES.warehouse,
      t(
        'Hệ thống chốt đơn giá = giá nhập gần nhất × tỷ lệ giá bán, trừ tồn kho và cộng nợ; số lượng không vượt tồn, nợ sau phiếu không vượt hạn mức.',
      ),
    ),
    step(
      'collect',
      msg('Lập phiếu thu'),
      states.collect,
      ROLES.accounting,
      t(
        'Khi đại lý trả tiền, lập phiếu thu với số tiền không vượt nợ hiện tại.',
      ),
    ),
  ]

  const postLock = !draft
    ? t('Chỉ ghi sổ được phiếu đang là nháp.')
    : doc.lines.length === 0
      ? t('Phiếu chưa có dòng hàng. Thêm ít nhất một dòng trước khi ghi sổ.')
      : null

  let next: NextAction | null = null
  if (draft)
    next = can.post
      ? {
          title: t('Ghi sổ để xuất hàng'),
          description: t(
            'Kiểm tra số lượng rồi bấm Ghi sổ. Đơn giá được chốt lúc ghi sổ; sau đó chỉ Hủy hoặc Sửa có lý do.',
          ),
        }
      : { title: t('Phiếu đang là nháp'), waitingFor: t(ROLES.warehouse) }
  else if (posted)
    next = can.collect
      ? {
          title: t('Lập phiếu thu khi đại lý trả tiền'),
          description: t(
            'Nợ của đại lý đã tăng theo {code}. Phiếu thu làm giảm nợ hiện tại.',
            { code: doc.code },
          ),
          to: collectLink(doc.agencyId),
          actionLabel: t('Lập phiếu thu'),
        }
      : { title: t('Chờ thu tiền đại lý'), waitingFor: t(ROLES.accounting) }

  return { steps, next, postLock }
}

/** Plain-language consequences of posting a stock issue (confirm dialog). */
export function issuePostEffects(doc: Pick<DocumentDetail, 'lines'>): string[] {
  return [
    ...doc.lines.map((line) =>
      t('Tồn kho {product}: −{quantity} {unit}', {
        product: line.productName,
        quantity: formatQuantity(line.quantity),
        unit: line.unitName,
      }),
    ),
    t(
      'Đơn giá xuất được chốt = giá nhập gần nhất × tỷ lệ giá bán; nợ của đại lý tăng đúng tổng tiền phiếu.',
    ),
    t('Nếu nợ sau phiếu vượt hạn mức của loại đại lý, ghi sổ bị từ chối.'),
  ]
}

/** Toast after posting a stock issue: the next step is a payment receipt. */
export function issuePostedNotice(
  doc: Pick<DocumentDetail, 'code' | 'agencyId'>,
): { done: string; next: string; to: string } {
  return {
    done: t('Đã ghi sổ {code}.', { code: doc.code || t('chứng từ') }),
    next: t(
      'Tồn kho đã giảm, nợ đại lý đã tăng. Bước tiếp: lập phiếu thu khi đại lý trả tiền.',
    ),
    to: collectLink(doc.agencyId),
  }
}

/** Consequences of posting a stock receipt. */
export function goodsPostEffects(doc: Pick<DocumentDetail, 'lines'>): string[] {
  return [
    ...doc.lines.map((line) =>
      t('Tồn kho {product}: +{quantity} {unit}', {
        product: line.productName,
        quantity: formatQuantity(line.quantity),
        unit: line.unitName,
      }),
    ),
    t('Giá nhập gần nhất của các mặt hàng được cập nhật theo phiếu này.'),
    t('Giá bán = giá nhập gần nhất × tỷ lệ giá bán trong quy định.'),
  ]
}

/** Lập nháp → Ghi sổ for stock receipts. */
export function goodsWorkflow(
  doc: Pick<DocumentDetail, 'status'>,
  canPost: boolean,
): { steps: WorkflowStep[]; next: NextAction | null } {
  const posted = doc.status === 'POSTED'
  const cancelled = doc.status === 'CANCELLED'
  const steps = [
    step(
      'draft',
      msg('Lập nháp'),
      cancelled || posted ? 'done' : 'current',
      ROLES.warehouse,
    ),
    step(
      'post',
      msg('Ghi sổ'),
      posted ? 'done' : cancelled ? 'skipped' : 'todo',
      ROLES.warehouse,
      cancelled
        ? t('Phiếu đã hủy.')
        : t('Cộng tồn kho và cập nhật giá nhập gần nhất.'),
    ),
  ]
  const next: NextAction | null =
    posted || cancelled
      ? null
      : canPost
        ? {
            title: t('Ghi sổ khi đã kiểm tra đủ dòng hàng'),
            description: t(
              'Sau khi ghi sổ, chỉ thay đổi được bằng Hủy hoặc Sửa có lý do.',
            ),
          }
        : { title: t('Phiếu đang là nháp'), waitingFor: t(ROLES.warehouse) }
  return { steps, next }
}

/** Bottom-right toast text after a payment receipt action. */
export function receiptNotice(
  action: 'create' | 'post' | 'delete',
  code: string,
): { done: string; next?: string; to?: string } {
  const ref = code || t('chứng từ')
  if (action === 'create')
    return {
      done: t('Đã tạo nháp {code}.', { code: ref }),
      next: t(
        'Bước tiếp: kiểm tra số tiền rồi Ghi sổ; nợ đại lý chỉ giảm sau khi ghi sổ.',
      ),
    }
  if (action === 'post')
    return {
      done: t('Đã ghi sổ {code}.', { code: ref }),
      next: t('Nợ hiện tại của đại lý đã giảm đúng số tiền thu.'),
      to: '/agencies',
    }
  return { done: t('Đã xóa nháp {code}.', { code: ref }) }
}

/** "Việc cần làm tiếp" for a payment receipt. */
export function receiptNext(
  item: Pick<DocumentDetail, 'status'>,
  can: { post: boolean },
): NextAction | null {
  if (item.status !== 'DRAFT') return null
  return can.post
    ? {
        title: t('Ghi sổ để giảm nợ'),
        description: t(
          'Số tiền phải lớn hơn 0 và không vượt nợ hiện tại của đại lý; nợ chỉ giảm sau khi ghi sổ.',
        ),
      }
    : { title: t('Phiếu đang là nháp'), waitingFor: t(ROLES.accounting) }
}

/** Toast after cancelling or correcting ("sửa có lý do") a posted document. */
export function documentChangeNotice(
  action: 'cancel' | 'correct',
  code: string,
  newCode?: string,
): { done: string; next: string } {
  const ref = code || t('chứng từ')
  return action === 'cancel'
    ? {
        done: t('Đã hủy {code}.', { code: ref }),
        next: t(
          'Ảnh hưởng của phiếu (tồn kho, nợ) đã được đảo lại; lý do được lưu trong lịch sử.',
        ),
      }
    : {
        done: t('Đã sửa {code} thành {newCode}.', {
          code: ref,
          newCode: newCode || t('phiếu mới'),
        }),
        next: t(
          'Phiếu cũ đã bị hủy và thay bằng phiếu mới đã ghi sổ; xem chuỗi thay thế trong Lịch sử chứng từ.',
        ),
      }
}

/** Toast after "đối soát" of an online payment, by server status. */
export function reconcileNotice(status: unknown): {
  done: string
  next?: string
  to?: string
} {
  if (status === 'SUCCESS')
    return {
      done: t('Cổng thanh toán xác nhận giao dịch thành công.'),
      next: t('Phiếu thu đã được lập tự động và nợ đại lý đã giảm.'),
      to: '/payment-receipts',
    }
  if (status === 'FAILED')
    return {
      done: t('Cổng thanh toán báo giao dịch không thành công.'),
      next: t(
        'Không có tiền được ghi nhận. Tạo giao dịch mới nếu đại lý muốn trả lại.',
      ),
    }
  if (status === 'EXPIRED')
    return {
      done: t('Giao dịch đã quá hạn.'),
      next: t('Tạo giao dịch mới nếu đại lý vẫn muốn thanh toán.'),
    }
  return {
    done: t('Cổng thanh toán chưa có kết quả cuối cùng.'),
    next: t(
      'Đối soát lại sau ít phút; không tạo giao dịch mới cho cùng khoản tiền.',
    ),
  }
}

/** Rail of the cancel / "sửa có lý do" dialog (the user is at step 2). */
export function correctionSteps(cancel: boolean): WorkflowStep[] {
  return [
    step(
      'pick',
      msg('Chọn chứng từ đã ghi sổ'),
      'done',
      ROLES.management,
      t('Chỉ chứng từ có ngày trong tháng hiện tại.'),
    ),
    step(
      'change',
      cancel
        ? msg('Hủy (nhập lý do)')
        : msg('Sửa (nhập lý do và nội dung mới)'),
      'current',
      ROLES.management,
      cancel
        ? t('Hủy không hoàn tác; lý do được lưu vào lịch sử.')
        : t('Nhập lại nội dung đúng; phiếu cũ được giữ trong chuỗi thay thế.'),
    ),
    step(
      'apply',
      msg('Hệ thống đảo ảnh hưởng'),
      'todo',
      undefined,
      cancel
        ? t('Tồn kho và nợ đại lý được đảo đúng theo phiếu bị hủy.')
        : t(
            'Phiếu cũ bị hủy và phiếu mới (mã mới) được ghi sổ trong cùng một lần; nếu phiếu mới vi phạm quy định thì không có gì thay đổi.',
          ),
    ),
  ]
}

/** True when the business-rule form differs from the saved values. */
export function dirtyRules(
  capacity: string,
  rate: string,
  saved: { capacity: string; rate: string },
): boolean {
  return capacity !== saved.capacity || rate !== saved.rate
}

/** Rail of the business-rules page: edit → server validates → saved. */
export function ruleSteps(dirty: boolean, saved: boolean): WorkflowStep[] {
  return [
    step(
      'edit',
      msg('Sửa giá trị'),
      dirty ? 'current' : saved ? 'done' : 'current',
      ROLES.management,
      t('Giới hạn đại lý mỗi phường/xã và tỷ lệ giá bán so với giá nhập.'),
    ),
    step(
      'check',
      msg('Kiểm tra dữ liệu hiện có'),
      dirty ? 'todo' : saved ? 'done' : 'todo',
      undefined,
      t(
        'Máy chủ từ chối giới hạn nhỏ hơn số đại lý đang hoạt động trong một phường/xã.',
      ),
    ),
    step(
      'save',
      msg('Lưu quy định'),
      saved && !dirty ? 'done' : 'todo',
      ROLES.management,
      t(
        'Giá bán mới áp dụng cho phiếu xuất ghi sổ sau; phiếu đã ghi sổ giữ đơn giá đã chốt.',
      ),
    ),
  ]
}

/** Toast after saving a catalogue / user / group record. */
export function masterNotice(
  path: string,
  creating: boolean,
): { done: string; next?: string; to?: string } {
  const done = creating ? t('Đã thêm mới.') : t('Đã lưu thay đổi.')
  if (path === '/users' && creating)
    return {
      done: t('Đã tạo tài khoản.'),
      next: t('Bước tiếp: kiểm tra nhóm của tài khoản và quyền của nhóm.'),
      to: '/permissions',
    }
  if (path === '/user-groups' && creating)
    return {
      done: t('Đã tạo nhóm người dùng.'),
      next: t(
        'Bước tiếp: phân quyền chức năng cho nhóm, rồi gán tài khoản vào nhóm.',
      ),
      to: '/permissions',
    }
  if (path === '/products' && creating)
    return {
      done: t('Đã thêm mặt hàng.'),
      next: t(
        'Bước tiếp: ghi sổ một phiếu nhập để mặt hàng có tồn kho, giá nhập và giá bán.',
      ),
      to: '/stock-receipts',
    }
  return { done }
}

/** Rail of the reports page: choose filters → apply → export. */
export function reportSteps(
  applied: boolean,
  dirty: boolean,
  exported: boolean,
): WorkflowStep[] {
  return [
    step(
      'filter',
      msg('Chọn kỳ và bộ lọc'),
      applied && !dirty ? 'done' : 'current',
      undefined,
      t('Chọn loại báo cáo, tháng hoặc khoảng ngày, đại lý/mặt hàng nếu cần.'),
    ),
    step(
      'apply',
      msg('Áp dụng'),
      applied && !dirty ? 'done' : 'todo',
      undefined,
      t(
        'Báo cáo chỉ tải khi bấm Áp dụng; đổi bộ lọc mà chưa áp dụng thì số liệu vẫn là của bộ lọc cũ.',
      ),
    ),
    step(
      'export',
      msg('Xuất PDF/XLSX'),
      exported ? 'done' : applied && !dirty ? 'current' : 'todo',
      undefined,
      t('Xuất toàn bộ kết quả của bộ lọc đã áp dụng.'),
    ),
  ]
}
