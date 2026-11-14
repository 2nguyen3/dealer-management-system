import type { NextAction } from '@/components/guide/NextActionCallout'
import type { StepState, WorkflowStep } from '@/components/guide/WorkflowSteps'
import { formatQuantity, formatVND } from '@/lib/formatters'
import { msg, t } from '@/lib/i18n/core'
import type {
  DocumentDetail,
  GoodsKind,
} from '../document_history/documentContracts'

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

/** State of the upfront confirmation attached to the issue's current revision. */
export type UpfrontState =
  'NONE' | 'VERIFIED' | 'CONSUMED' | 'RECEIVED_SEPARATELY' | 'UNKNOWN'

export interface IssueAbilities {
  prepare: boolean
  post: boolean
  verify: boolean
}

export interface IssueWorkflow {
  steps: WorkflowStep[]
  next: NextAction | null
  /** Why "Ghi sổ" cannot succeed yet (null = predicted OK). */
  postLock: string | null
  /** Why "Nộp phiếu" cannot succeed yet. */
  submitLock: string | null
  /** Why "Thay nội dung chờ xuất" is refused by the server. */
  replaceLock: string | null
  /** Upfront amount that must be verified ('' when none). */
  upfront: string
}

/** Deep link that opens the upfront form with this issue preselected. */
export function upfrontLink(documentId: string): string {
  return `/upfront-payments?issue=${encodeURIComponent(documentId)}&new=1`
}

/**
 * Stock issue: Nháp → Nộp (giá chốt, hạn mức) → Xác nhận trả ngay (only when
 * immediatePayment > 0) → Ghi sổ. `upfront` is the state of the confirmation
 * of the CURRENT revision (detail `upfrontConfirmationId` + its record).
 */
export function stockIssueWorkflow(
  doc: Pick<
    DocumentDetail,
    'id' | 'code' | 'status' | 'currentRevision' | 'upfrontConfirmationId'
  >,
  upfront: UpfrontState,
  can: IssueAbilities,
): IssueWorkflow {
  const revision = doc.currentRevision
  const amount = positiveMoney(revision.immediatePayment)
    ? revision.immediatePayment
    : ''
  const needsUpfront = amount !== ''
  // While the confirmation record loads (UNKNOWN), predict nothing: the server decides.
  const verified =
    upfront === 'VERIFIED' ||
    upfront === 'CONSUMED' ||
    (upfront === 'UNKNOWN' && !!doc.upfrontConfirmationId)
  const separated = upfront === 'RECEIVED_SEPARATELY'
  const draft = doc.status === 'DRAFT' && revision.state === 'DRAFT'
  const ready = doc.status === 'PENDING' && revision.state === 'READY'
  const posted = doc.status === 'POSTED'
  const cancelled = doc.status === 'CANCELLED'
  const money = formatVND(amount || '0')

  const upfrontHint = needsUpfront
    ? t(
        'Kế toán xác nhận đã thực nhận {amount} cho đúng phiên bản đang chờ xuất.',
        { amount: money },
      )
    : t('Phiếu không có khoản trả ngay nên bỏ qua bước này.')
  const cancelledHint = t('Phiếu đã hủy.')

  const states: Record<'draft' | 'submit' | 'upfront' | 'post', StepState> =
    cancelled
      ? {
          draft: 'done',
          submit: 'skipped',
          upfront: 'skipped',
          post: 'skipped',
        }
      : posted
        ? {
            draft: 'done',
            submit: 'done',
            upfront: needsUpfront ? 'done' : 'skipped',
            post: 'done',
          }
        : ready
          ? {
              draft: 'done',
              submit: 'done',
              upfront: !needsUpfront
                ? 'skipped'
                : verified
                  ? 'done'
                  : separated
                    ? 'blocked'
                    : 'current',
              post: !needsUpfront || verified ? 'current' : 'blocked',
            }
          : {
              draft: 'current',
              submit: 'todo',
              upfront: needsUpfront ? 'todo' : 'skipped',
              post: 'todo',
            }

  const steps = [
    step(
      'draft',
      msg('Lập nháp'),
      states.draft,
      ROLES.sales,
      cancelled
        ? cancelledHint
        : t('Chọn đại lý, ngày, các dòng hàng và khoản trả ngay (nếu có).'),
    ),
    step(
      'submit',
      msg('Nộp phiếu'),
      states.submit,
      ROLES.sales,
      t('Hệ thống chốt giá bán, kiểm tra tồn kho và hạn mức nợ của đại lý.'),
    ),
    step(
      'upfront',
      msg('Xác nhận trả ngay'),
      states.upfront,
      ROLES.accounting,
      separated
        ? t(
            'Khoản tiền đã thành phiếu thu riêng, không còn gắn với phiếu này. Thay nội dung phiếu (phiên bản mới); không nhập lại số tiền đã thu vào trả ngay để tránh tính hai lần.',
          )
        : upfrontHint,
    ),
    step(
      'post',
      msg('Ghi sổ xuất kho'),
      states.post,
      ROLES.warehouse,
      needsUpfront
        ? t('Trừ tồn kho, ghi công nợ và tự lập phiếu thu cho khoản trả ngay.')
        : t('Trừ tồn kho và ghi công nợ cho đại lý.'),
    ),
  ]

  let postLock: string | null = null
  if (!ready)
    postLock = t('Phiếu phải được nộp (trạng thái Sẵn sàng) trước khi ghi sổ.')
  else if (needsUpfront && separated)
    postLock = t(
      'Khoản trả ngay đã được ghi nhận riêng thành phiếu thu. Thay nội dung phiếu (phiên bản mới) rồi nộp lại trước khi ghi sổ.',
    )
  else if (needsUpfront && !verified)
    postLock = t(
      'Chưa có xác nhận trả ngay {amount}. Kế toán cần xác nhận tiền thực nhận trước khi ghi sổ.',
      { amount: money },
    )

  const submitLock =
    draft && revision.lines.length === 0
      ? t('Phiếu chưa có dòng hàng. Sửa nháp để thêm ít nhất một dòng.')
      : null

  const replaceLock =
    ready && upfront === 'VERIFIED'
      ? t(
          'Phiếu đã có tiền trả ngay được xác nhận cho phiên bản này. Muốn thay nội dung, Kế toán phải Ghi nhận tiền riêng trước (tiền thành phiếu thu riêng).',
        )
      : null

  let next: NextAction | null = null
  if (draft) {
    next = can.prepare
      ? {
          title: t('Nộp phiếu để chốt giá'),
          description: needsUpfront
            ? t(
                'Sau khi nộp, Kế toán xác nhận khoản trả ngay {amount}, rồi Kho ghi sổ.',
                { amount: money },
              )
            : t('Sau khi nộp, Kho ghi sổ để xuất hàng.'),
        }
      : {
          title: t('Phiếu đang là nháp'),
          waitingFor: t(ROLES.sales),
        }
  } else if (ready && needsUpfront && !verified) {
    next = separated
      ? {
          title: t('Cần lập lại phiên bản phiếu'),
          description: t(
            'Khoản trả ngay đã thành phiếu thu riêng nên không dùng cho phiếu này nữa. Thay nội dung chờ xuất và nộp lại; chỉ nhập trả ngay nếu đại lý trả thêm tiền mới.',
          ),
          tone: 'warning',
        }
      : can.verify
        ? {
            title: t('Xác nhận khoản trả ngay {amount}', { amount: money }),
            description: t(
              'Ghi nhận tiền thực nhận cho phiên bản đang chờ xuất của {code}. Sau đó Kho mới ghi sổ được.',
              { code: doc.code },
            ),
            to: upfrontLink(doc.id),
            actionLabel: t('Mở form xác nhận'),
            tone: 'warning',
          }
        : {
            title: t('Chờ xác nhận khoản trả ngay {amount}', { amount: money }),
            description: t(
              'Kế toán ghi nhận tiền thực nhận trên trang Xác nhận trả ngay. Sửa và nộp lại phiếu không thay cho bước này.',
            ),
            waitingFor: t(ROLES.accounting),
            tone: 'warning',
          }
  } else if (ready) {
    next = can.post
      ? {
          title: t('Sẵn sàng ghi sổ'),
          description: t('Kiểm tra lại số lượng rồi bấm Ghi sổ để xuất kho.'),
        }
      : { title: t('Sẵn sàng ghi sổ'), waitingFor: t(ROLES.warehouse) }
  }

  return { steps, next, postLock, submitLock, replaceLock, upfront: amount }
}

/** Plain-language consequences of posting a stock issue (confirm dialog). */
export function issuePostEffects(
  doc: Pick<DocumentDetail, 'currentRevision'>,
): string[] {
  const revision = doc.currentRevision
  const lines = revision.lines.map((line) =>
    t('Tồn kho {product}: −{quantity} {unit}', {
      product: line.productName,
      quantity: formatQuantity(line.quantity),
      unit: line.unitName,
    }),
  )
  const effects = [...lines]
  effects.push(
    t('Công nợ đại lý tăng {total} (giá đã chốt khi nộp).', {
      total: formatVND(revision.totalAmount),
    }),
  )
  if (positiveMoney(revision.immediatePayment)) {
    const rest = subtractMoney(revision.totalAmount, revision.immediatePayment)
    effects.push(
      t(
        'Tự lập phiếu thu {amount} từ khoản trả ngay đã xác nhận; công nợ còn tăng thêm {rest}.',
        {
          amount: formatVND(revision.immediatePayment),
          rest: rest === null ? '—' : formatVND(rest),
        },
      ),
    )
  }
  return effects
}

/** Consequences of posting the other goods documents. */
export function goodsPostEffects(
  kind: Exclude<GoodsKind, 'STOCK_ISSUE'>,
  doc: Pick<DocumentDetail, 'currentRevision'>,
): string[] {
  const lines = doc.currentRevision.lines
  if (kind === 'STOCK_RECEIPT')
    return [
      ...lines.map((line) =>
        t('Tồn kho {product}: +{quantity} {unit}', {
          product: line.productName,
          quantity: formatQuantity(line.quantity),
          unit: line.unitName,
        }),
      ),
      t('Giá nhập hiện hành của các mặt hàng được cập nhật theo phiếu này.'),
      t(
        'Giá bán khi nộp phiếu xuất sau này = giá nhập × tỷ lệ giá bán trong quy định.',
      ),
    ]
  if (kind === 'SALES_RETURN')
    return [
      ...lines.map((line) =>
        t('Tồn kho {product}: +{quantity} {unit}', {
          product: line.productName,
          quantity: formatQuantity(line.quantity),
          unit: line.unitName,
        }),
      ),
      t(
        'Giảm công nợ của phiếu xuất gốc; phần vượt số nợ còn lại thành dư có cho đại lý.',
      ),
    ]
  return lines.map((line) =>
    t('Tồn kho {product}: {sign}{quantity} {unit}', {
      product: line.productName,
      sign: line.quantity.startsWith('-') ? '' : '+',
      quantity: formatQuantity(line.quantity),
      unit: line.unitName,
    }),
  )
}

/** Draft → Ghi sổ for receipts, returns and independent adjustments. */
export function goodsWorkflow(
  kind: Exclude<GoodsKind, 'STOCK_ISSUE'>,
  doc: Pick<DocumentDetail, 'status' | 'stockCountId'>,
  canPost: boolean,
): { steps: WorkflowStep[]; next: NextAction | null } {
  const role = kind === 'SALES_RETURN' ? ROLES.sales : ROLES.warehouse
  const postRole = kind === 'SALES_RETURN' ? ROLES.warehouse : ROLES.warehouse
  const fromCount = kind === 'STOCK_ADJUSTMENT' && !!doc.stockCountId
  const posted = doc.status === 'POSTED'
  const cancelled = doc.status === 'CANCELLED'
  const firstLabel =
    kind === 'SALES_RETURN'
      ? msg('Chọn phiếu xuất gốc & lập nháp')
      : msg('Lập nháp')
  const steps = [
    step(
      'draft',
      firstLabel,
      fromCount ? 'done' : cancelled || posted ? 'done' : 'current',
      fromCount ? ROLES.warehouse : role,
      fromCount ? t('Sinh tự động từ biên bản kiểm kê.') : undefined,
    ),
    step(
      'post',
      msg('Ghi sổ'),
      posted ? 'done' : cancelled ? 'skipped' : fromCount ? 'blocked' : 'todo',
      postRole,
      fromCount
        ? t('Được ghi sổ cùng biên bản kiểm kê, không ghi sổ riêng.')
        : cancelled
          ? t('Phiếu đã hủy.')
          : undefined,
    ),
  ]
  const next: NextAction | null =
    posted || cancelled || fromCount
      ? null
      : canPost
        ? {
            title: t('Ghi sổ khi đã kiểm tra đủ dòng hàng'),
            description: t(
              'Sau khi ghi sổ, chỉ sửa được bằng Sửa sai hoặc Hủy chứng từ.',
            ),
          }
        : { title: t('Phiếu đang là nháp'), waitingFor: t(postRole) }
  return { steps, next }
}

export type FinancialVariant = 'receipt' | 'credit' | 'refund'

/** Bottom-right toast text after a receipt / credit / refund action. */
export function financialNotice(
  variant: FinancialVariant,
  action: string,
  code: string,
): { done: string; next?: string; to?: string } {
  const ref = code || t('chứng từ')
  if (action === 'create')
    return {
      done: t('Đã tạo nháp {code}.', { code: ref }),
      next:
        variant === 'refund'
          ? t(
              'Bước tiếp: mở yêu cầu và bấm Giữ chỗ quỹ để khóa dư có cho khoản hoàn này.',
            )
          : variant === 'credit'
            ? t(
                'Bước tiếp: kiểm tra số tiền rồi Ghi sổ để trừ dư có vào công nợ.',
              )
            : t(
                'Bước tiếp: kiểm tra số tiền rồi Ghi sổ; công nợ chỉ giảm sau khi ghi sổ.',
              ),
    }
  if (action === 'post')
    return variant === 'credit'
      ? {
          done: t('Đã bù trừ dư có {code}.', { code: ref }),
          next: t('Dư có giảm và các hóa đơn còn nợ cũ nhất được trừ trước.'),
          to: '/agency-credit',
        }
      : {
          done: t('Đã ghi sổ {code}.', { code: ref }),
          next: t(
            'Tiền đã phân bổ vào hóa đơn cũ nhất trước (FIFO); công nợ đại lý đã giảm.',
          ),
          to: '/receivables',
        }
  if (action === 'submit')
    return {
      done: t('Đã giữ chỗ quỹ cho {code}.', { code: ref }),
      next: t(
        'Bước tiếp: chi tiền cho đại lý rồi bấm Xác nhận đã chi tiền, hoặc gửi Yêu cầu hoàn trực tuyến.',
      ),
    }
  if (action === 'confirm-paid')
    return {
      done: t('Đã ghi nhận chi tiền {code}.', { code: ref }),
      next: t('Yêu cầu hoàn tiền đã hoàn tất; dư có của đại lý đã giảm.'),
      to: '/agency-credit',
    }
  if (action === 'attempts')
    return {
      done: t('Đã gửi yêu cầu hoàn trực tuyến {code}.', { code: ref }),
      next: t(
        'Chờ cổng thanh toán xác nhận; nếu lâu chưa có kết quả, bấm Đối soát lần thử hiện tại.',
      ),
    }
  if (action === 'reconcile')
    return {
      done: t('Đã đối soát với cổng thanh toán.'),
      next: t('Xem trạng thái mới nhất của lần hoàn trong chi tiết.'),
    }
  if (action === 'cancel') return { done: t('Đã hủy {code}.', { code: ref }) }
  return { done: t('Đã thực hiện thao tác.') }
}

/** "Việc cần làm tiếp" for receipts, credit applications and refunds. */
export function financialNext(
  variant: FinancialVariant,
  item: {
    status: string
    reservedAmount?: string
    latestAttemptState?: string | null
  },
  can: { post: boolean; manual: boolean; reserved: boolean; unknown: boolean },
): NextAction | null {
  if (item.status !== 'DRAFT') return null
  if (variant === 'receipt' && !can.manual) return null
  const role = variant === 'credit' ? ROLES.accounting : ROLES.accounting
  if (variant === 'refund') {
    if (can.unknown)
      return {
        title: t('Chờ kết quả hoàn trực tuyến'),
        description: t(
          'Không hủy hoặc tạo lần mới; bấm Đối soát lần thử hiện tại để hỏi lại cổng.',
        ),
        tone: 'warning',
        ...(can.post ? {} : { waitingFor: t(role) }),
      }
    if (!can.reserved)
      return can.post
        ? {
            title: t('Giữ chỗ quỹ hoàn tiền'),
            description: t(
              'Khóa số dư có của đại lý cho yêu cầu này trước khi chi tiền.',
            ),
          }
        : { title: t('Chờ giữ chỗ quỹ'), waitingFor: t(role) }
    return can.post
      ? {
          title: t('Chi tiền cho đại lý'),
          description: t(
            'Chi tiền mặt/chuyển khoản rồi Xác nhận đã chi tiền; với hoàn online, gửi Yêu cầu hoàn trực tuyến.',
          ),
        }
      : { title: t('Chờ chi tiền cho đại lý'), waitingFor: t(role) }
  }
  return can.post
    ? {
        title: t('Ghi sổ để cập nhật công nợ'),
        description:
          variant === 'credit'
            ? t('Bù trừ chỉ có hiệu lực sau khi ghi sổ.')
            : t(
                'Công nợ chỉ giảm sau khi ghi sổ; tiền trừ vào hóa đơn cũ nhất trước.',
              ),
      }
    : { title: t('Phiếu đang là nháp'), waitingFor: t(role) }
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
      next: t('Phiếu thu đã được lập tự động và công nợ đại lý đã giảm.'),
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

/** Rail of the correction / cancellation dialog (the user is at step 2). */
export function correctionSteps(cancel: boolean): WorkflowStep[] {
  return [
    step('pick', msg('Chọn chứng từ đã ghi sổ'), 'done', ROLES.management),
    step(
      'change',
      cancel ? msg('Hủy (nhập lý do)') : msg('Sửa (phiên bản mới)'),
      'current',
      ROLES.management,
      cancel
        ? t('Hủy không hoàn tác; lý do được lưu vào nhật ký.')
        : t(
            'Nhập lại toàn bộ nội dung đúng; phiên bản cũ được giữ trong lịch sử.',
          ),
    ),
    step(
      'replay',
      msg('Hệ thống tính lại'),
      'todo',
      undefined,
      t(
        'Tồn kho, công nợ, dư có của các chứng từ phía sau được tính lại theo ngày nghiệp vụ.',
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
      t('Chỉ áp dụng cho chứng từ lập sau; giá trên chứng từ cũ không đổi.'),
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
        'Bước tiếp: ghi sổ một phiếu nhập để mặt hàng có giá nhập và tồn kho.',
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
