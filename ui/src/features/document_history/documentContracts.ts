import type { FunctionCode } from '../../lib/types'
import { t } from '@/lib/i18n/core'

/**
 * The three document kinds of the simplified model (handoff §3.1) with their
 * own routes and grants. Read grants mirror each list operation's
 * `x-permissions.anyOf` in the HTTP contract.
 */
export const documentKinds = {
  STOCK_RECEIPT: {
    path: '/stock-receipts',
    route: '/stock-receipts',
    title: t('Phiếu nhập hàng'),
    prepare: 'stock.receipt.prepare',
    post: 'stock.receipt.post',
    read: [
      'stock.receipt.prepare',
      'stock.receipt.post',
      'product.manage',
      'reports.read',
      'documents.correct',
      'documents.cancel',
    ],
  },
  STOCK_ISSUE: {
    path: '/stock-issues',
    route: '/stock-issues',
    title: t('Phiếu xuất hàng'),
    prepare: 'stock.issue.prepare',
    post: 'stock.issue.post',
    read: [
      'stock.issue.prepare',
      'stock.issue.post',
      'sales.read',
      'debt.read',
      'reports.read',
      'documents.correct',
      'documents.cancel',
    ],
  },
  PAYMENT_RECEIPT: {
    path: '/payment-receipts',
    route: '/payment-receipts',
    title: t('Phiếu thu tiền'),
    prepare: 'cash.receipt.prepare',
    post: 'cash.receipt.post',
    read: [
      'cash.receipt.prepare',
      'cash.receipt.post',
      'debt.read',
      'payments.online',
      'reports.read',
      'documents.correct',
      'documents.cancel',
    ],
  },
} as const satisfies Record<
  string,
  {
    path: string
    route: string
    title: string
    prepare: FunctionCode
    post: FunctionCode
    read: readonly FunctionCode[]
  }
>
export type DocumentKind = keyof typeof documentKinds
export type GoodsKind = 'STOCK_RECEIPT' | 'STOCK_ISSUE'
export type DocumentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'
export type ReceiptType = 'CASH' | 'BANK_TRANSFER' | 'ONLINE'
/** Receipt types a person may choose; ONLINE is created only by VNPAY IPN. */
export const MANUAL_RECEIPT_TYPES = ['CASH', 'BANK_TRANSFER'] as const
export type ManualReceiptType = (typeof MANUAL_RECEIPT_TYPES)[number]
export const DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
]
export const RECEIPT_TYPES: readonly ReceiptType[] = [
  'CASH',
  'BANK_TRANSFER',
  'ONLINE',
]
export type PermissionCheck = (
  permission: FunctionCode | FunctionCode[],
) => boolean
export interface Page<T> {
  items: T[]
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
}

/** `DocumentSummary` of the contract (list rows). */
export interface DocumentSummary {
  id: string
  code: string
  kind: DocumentKind
  status: DocumentStatus
  businessDate: string
  agencyId: string | null
  agencyCode: string | null
  agencyName: string | null
  receiptType: ReceiptType | null
  totalAmount: string
  lineCount: number
  note: string | null
  replacesDocumentId: string | null
  replacedByDocumentId: string | null
  createdBy: string | null
  createdByName: string | null
  postedBy: string | null
  postedByName: string | null
  postedAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}
/** One step of a replacement chain (`ChainItem`). */
export interface ChainItem extends DocumentSummary {
  cancelReason: string | null
}
export interface DocumentReference {
  id: string
  code: string
  status: DocumentStatus
}
export interface DocumentLine {
  id: string
  lineNo: number
  productId: string
  productCode: string
  productName: string
  unitId: number
  unitName: string
  quantity: string
  unitPrice: string
  lineAmount: string
}
/** Full `Document` of the contract (detail and every mutation response). */
export interface DocumentDetail extends ChainItem {
  sellingPriceRate: string | null
  cancelledBy: string | null
  cancelledByName: string | null
  replaces: DocumentReference | null
  replacedBy: DocumentReference | null
  onlinePaymentId: string | null
  /** Agency's CURRENT debt (not part of the ETag); may be negative. */
  agencyDebt: string | null
  agencyMaxDebt: string | null
  lines: DocumentLine[]
}

export const exact = {
  id: /^[1-9][0-9]{0,18}$/,
  code: /^(PN|PX|PT)-[1-9][0-9]*$/,
  money: /^(0|[1-9][0-9]{0,17})$/,
  signedMoney: /^-?(0|[1-9][0-9]{0,17})$/,
  positiveMoney: /^[1-9][0-9]{0,17}$/,
  quantity: /^(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$/,
  rate: /^(?!0(?:\.0{1,6})?$)(0|[1-9][0-9]{0,2})(\.[0-9]{1,6})?$/,
}
export function isZero(value: string) {
  return /^-?0(?:\.0+)?$/.test(value)
}
export function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    exact.id.test(value) &&
    (value.length < 19 || value <= '9223372036854775807')
  )
}
export function validDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000')
  )
    return false
  const date = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  )
}
export function vietnamToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(t('Phản hồi máy chủ không hợp lệ.'))
  return value as Record<string, unknown>
}
function numeric(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string' || !pattern.test(value))
    throw new Error(t('Giá trị số từ máy chủ không hợp lệ.'))
}
const nullableId = (value: unknown) => value === null || validId(value)
const nullableText = (value: unknown) =>
  value === null || typeof value === 'string'

export function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
): Page<T> {
  const data = object(value),
    pagination = object(data.pagination)
  if (
    !Array.isArray(data.items) ||
    !Number.isInteger(pagination.limit) ||
    (pagination.limit as number) < 1 ||
    (pagination.limit as number) > 100 ||
    typeof pagination.hasMore !== 'boolean' ||
    !(
      pagination.nextCursor === null ||
      typeof pagination.nextCursor === 'string'
    ) ||
    (pagination.hasMore && !pagination.nextCursor)
  )
    throw new Error(t('Phân trang máy chủ không hợp lệ.'))
  return {
    items: data.items.map(parseItem),
    pagination: pagination as unknown as Page<T>['pagination'],
  }
}
export function parseSummary(value: unknown): DocumentSummary {
  const row = object(value)
  if (
    !validId(row.id) ||
    typeof row.code !== 'string' ||
    !exact.code.test(row.code) ||
    typeof row.kind !== 'string' ||
    !Object.hasOwn(documentKinds, row.kind) ||
    !DOCUMENT_STATUSES.includes(row.status as DocumentStatus) ||
    !validDate(row.businessDate) ||
    !nullableId(row.agencyId) ||
    !nullableText(row.agencyCode) ||
    !nullableText(row.agencyName) ||
    !(
      row.receiptType === null ||
      RECEIPT_TYPES.includes(row.receiptType as ReceiptType)
    ) ||
    !Number.isInteger(row.lineCount) ||
    (row.lineCount as number) < 0 ||
    !nullableText(row.note) ||
    !nullableId(row.replacesDocumentId) ||
    !nullableId(row.replacedByDocumentId) ||
    typeof row.createdAt !== 'string'
  )
    throw new Error(t('Tóm tắt chứng từ không hợp lệ.'))
  numeric(row.totalAmount, exact.money)
  // Goods receipts never carry an agency; issues and payments always do.
  if ((row.kind === 'STOCK_RECEIPT') !== (row.agencyId === null))
    throw new Error(t('Tóm tắt chứng từ không hợp lệ.'))
  return row as unknown as DocumentSummary
}
export function parseChainItem(value: unknown): ChainItem {
  const row = parseSummary(value)
  if (!nullableText((row as unknown as Record<string, unknown>).cancelReason))
    throw new Error(t('Tóm tắt chứng từ không hợp lệ.'))
  return row as ChainItem
}
export function parseLine(value: unknown): DocumentLine {
  const row = object(value)
  if (
    !validId(row.id) ||
    !validId(row.productId) ||
    !Number.isInteger(row.lineNo) ||
    typeof row.productName !== 'string' ||
    typeof row.unitName !== 'string'
  )
    throw new Error(t('Dòng chứng từ không hợp lệ.'))
  numeric(row.quantity, exact.quantity)
  numeric(row.unitPrice, exact.money)
  numeric(row.lineAmount, exact.money)
  if (isZero(String(row.quantity)))
    throw new Error(t('Số lượng dòng không hợp lệ.'))
  return row as unknown as DocumentLine
}
function parseReference(value: unknown): DocumentReference | null {
  if (value === null || value === undefined) return null
  const row = object(value)
  if (
    !validId(row.id) ||
    typeof row.code !== 'string' ||
    !DOCUMENT_STATUSES.includes(row.status as DocumentStatus)
  )
    throw new Error(t('Liên kết chứng từ không hợp lệ.'))
  return row as unknown as DocumentReference
}
export function parseDocument(value: unknown): DocumentDetail {
  const row = object(value)
  const summary = parseChainItem(row)
  if (!Array.isArray(row.lines)) throw new Error(t('Chứng từ không hợp lệ.'))
  if (row.agencyDebt !== null && row.agencyDebt !== undefined)
    numeric(row.agencyDebt, exact.signedMoney)
  if (row.agencyMaxDebt !== null && row.agencyMaxDebt !== undefined)
    numeric(row.agencyMaxDebt, exact.money)
  if (
    row.sellingPriceRate !== null &&
    row.sellingPriceRate !== undefined &&
    (typeof row.sellingPriceRate !== 'string' ||
      !exact.rate.test(row.sellingPriceRate))
  )
    throw new Error(t('Giá trị số từ máy chủ không hợp lệ.'))
  const replaces = parseReference(row.replaces)
  const replacedBy = parseReference(row.replacedBy)
  return {
    ...summary,
    sellingPriceRate: (row.sellingPriceRate as string | null) ?? null,
    cancelledBy: (row.cancelledBy as string | null) ?? null,
    cancelledByName: (row.cancelledByName as string | null) ?? null,
    cancelReason: (row.cancelReason as string | null) ?? null,
    replaces,
    replacedBy,
    onlinePaymentId: (row.onlinePaymentId as string | null) ?? null,
    agencyDebt: (row.agencyDebt as string | null) ?? null,
    agencyMaxDebt: (row.agencyMaxDebt as string | null) ?? null,
    lines: row.lines.map(parseLine),
  }
}
export function parseChain(value: unknown): ChainItem[] {
  const data = object(value)
  if (!Array.isArray(data.items))
    throw new Error(t('Chuỗi thay thế không hợp lệ.'))
  return data.items.map(parseChainItem)
}

export function canReadKind(kind: DocumentKind, has: PermissionCheck) {
  return documentKinds[kind].read.some((grant) => has(grant))
}

/** `YYYY-MM` of a business date. */
export function monthOf(date: string) {
  return date.slice(0, 7)
}

/** Why a posted document cannot be cancelled/corrected, or null when it can. */
export function changeBlock(
  doc: Pick<DocumentDetail, 'status' | 'businessDate' | 'receiptType'>,
  today: string = vietnamToday(),
): string | null {
  if (doc.status !== 'POSTED') return t('Chỉ hủy hoặc sửa chứng từ đã ghi sổ.')
  if (doc.receiptType === 'ONLINE')
    return t(
      'Phiếu thu trực tuyến do cổng thanh toán xác nhận, không hủy hoặc sửa được.',
    )
  if (monthOf(doc.businessDate) !== monthOf(today))
    return t(
      'Chỉ hủy hoặc sửa chứng từ có ngày trong tháng hiện tại; tháng cũ đã chốt.',
    )
  return null
}

/**
 * Whether the user may cancel / correct this document (QĐ8, grants). The
 * server stays the authority and answers PERIOD_CLOSED/STATE_CONFLICT.
 */
export function canChange(
  doc: Pick<DocumentDetail, 'kind' | 'status' | 'businessDate' | 'receiptType'>,
  mode: 'correct' | 'cancel',
  has: PermissionCheck,
  today: string = vietnamToday(),
) {
  if (changeBlock(doc, today)) return false
  if (mode === 'cancel') return has('documents.cancel')
  return has('documents.correct') && has(documentKinds[doc.kind].post)
}

export interface LineInput {
  productId: string
  quantity: string
  unitPrice: string
}
export const emptyLine = (): LineInput => ({
  productId: '',
  quantity: '',
  unitPrice: '',
})

/** Validated `ReceiptLineInput[]` / `IssueLineInput[]` request lines. */
export function inputLines(kind: GoodsKind, lines: LineInput[]) {
  if (!lines.length) throw new Error(t('Cần ít nhất một dòng hàng.'))
  const seen = new Set<string>()
  return lines.map((line) => {
    const id = line.productId
    if (!validId(id)) throw new Error(t('Vui lòng chọn mặt hàng cho mọi dòng.'))
    if (seen.has(id))
      throw new Error(t('Mỗi mặt hàng chỉ được một dòng trên phiếu.'))
    seen.add(id)
    const quantity = line.quantity.trim()
    if (!exact.quantity.test(quantity) || isZero(quantity))
      throw new Error(
        t('Số lượng phải là số dương, tối đa 3 chữ số thập phân.'),
      )
    if (kind === 'STOCK_RECEIPT') {
      const unitPrice = line.unitPrice.trim()
      if (!exact.positiveMoney.test(unitPrice))
        throw new Error(
          t('Giá nhập phải là số nguyên VNĐ dương, tối đa 18 chữ số.'),
        )
      return { productId: id, quantity, unitPrice }
    }
    return { productId: id, quantity }
  })
}

/** Editable content of a draft, a new document or a correction. */
export interface DocumentForm {
  businessDate: string
  note: string
  agencyId: string
  receiptType: ManualReceiptType
  amount: string
  lines: LineInput[]
  reason: string
}

export function emptyForm(today: string = vietnamToday()): DocumentForm {
  return {
    businessDate: today,
    note: '',
    agencyId: '',
    receiptType: 'CASH',
    amount: '',
    lines: [emptyLine()],
    reason: '',
  }
}

/** Form prefilled from an existing document (draft edit or correction). */
export function formFromDocument(doc: DocumentDetail): DocumentForm {
  return {
    businessDate: doc.businessDate,
    note: doc.note ?? '',
    agencyId: doc.agencyId ?? '',
    receiptType: doc.receiptType === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
    amount: doc.kind === 'PAYMENT_RECEIPT' ? doc.totalAmount : '',
    lines: doc.lines.length
      ? doc.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: doc.kind === 'STOCK_RECEIPT' ? line.unitPrice : '',
        }))
      : [emptyLine()],
    reason: '',
  }
}

/**
 * Request body of `POST /{kind}` / `PUT /{kind}/{id}` (`mode: 'draft'`) or of
 * `POST /{kind}/{id}/corrections` (`mode: 'correct'`, agency stays fixed).
 */
export function documentBody(
  kind: DocumentKind,
  form: DocumentForm,
  mode: 'draft' | 'correct',
  today: string = vietnamToday(),
): Record<string, unknown> {
  if (!validDate(form.businessDate))
    throw new Error(t('Ngày chứng từ không hợp lệ.'))
  if (form.businessDate > today)
    throw new Error(t('Ngày chứng từ không được sau hôm nay.'))
  const body: Record<string, unknown> = {
    businessDate: form.businessDate,
    note: form.note.trim() || null,
  }
  if (mode === 'correct') {
    if (!form.reason.trim()) throw new Error(t('Vui lòng nhập lý do sửa.'))
    if (monthOf(form.businessDate) !== monthOf(today))
      throw new Error(t('Phiếu thay thế phải có ngày trong tháng hiện tại.'))
    body.reason = form.reason.trim()
  } else if (kind !== 'STOCK_RECEIPT') {
    if (!validId(form.agencyId)) throw new Error(t('Vui lòng chọn đại lý.'))
    body.agencyId = form.agencyId
  }
  if (kind === 'PAYMENT_RECEIPT') {
    if (!MANUAL_RECEIPT_TYPES.includes(form.receiptType))
      throw new Error(t('Hình thức thu không hợp lệ.'))
    const amount = form.amount.trim()
    if (!exact.positiveMoney.test(amount))
      throw new Error(
        t('Số tiền phải là số nguyên VNĐ dương, tối đa 18 chữ số.'),
      )
    body.receiptType = form.receiptType
    body.amount = amount
    return body
  }
  body.lines = inputLines(kind, form.lines)
  return body
}

/** Exact comparison of two whole-VND strings (may be negative). */
export function compareMoney(a: string, b: string): number {
  const x = BigInt(a),
    y = BigInt(b)
  return x === y ? 0 : x > y ? 1 : -1
}

/**
 * Amount to prefill on the payment receipt opened after posting an issue:
 * the issue total, capped at the agency's debt after posting. Null when the
 * agency owes nothing (e.g. it had prepaid online).
 */
export function receiptAmountAfterIssue(
  totalAmount: string,
  agencyDebt: string | null,
): string | null {
  if (!exact.money.test(totalAmount) || totalAmount === '0') return null
  if (agencyDebt === null || !exact.signedMoney.test(agencyDebt))
    return totalAmount
  if (compareMoney(agencyDebt, '0') <= 0) return null
  return compareMoney(agencyDebt, totalAmount) < 0 ? agencyDebt : totalAmount
}

/** Deep link of a kind's page that opens one document's detail. */
export function documentLink(kind: DocumentKind, id: string) {
  return `${documentKinds[kind].route}?document=${encodeURIComponent(id)}`
}

/** Deep link of the payment-receipt form prefilled for an agency/amount. */
export function receiptFormLink(agencyId: string, amount: string | null) {
  const query = new URLSearchParams({ new: '1', agencyId })
  if (amount) query.set('amount', amount)
  return `/payment-receipts?${query}`
}
