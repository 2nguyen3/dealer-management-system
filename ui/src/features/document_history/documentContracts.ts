import type { FunctionCode } from '../../lib/types'

export const documentKinds = {
  STOCK_RECEIPT: {
    path: '/stock-receipts',
    title: 'Phiếu nhập hàng',
    prepare: 'stock.receipt.prepare',
    post: 'stock.receipt.post',
    read: ['stock.receipt.prepare', 'stock.receipt.post', 'inventory.read'],
  },
  STOCK_ISSUE: {
    path: '/stock-issues',
    title: 'Phiếu xuất hàng',
    prepare: 'stock.issue.prepare',
    post: 'stock.issue.post',
    read: [
      'stock.issue.prepare',
      'stock.issue.post',
      'debt.read',
      'sales.read',
    ],
  },
  STOCK_ADJUSTMENT: {
    path: '/stock-adjustments',
    title: 'Điều chỉnh kho',
    prepare: 'stock.adjustment.prepare',
    post: 'stock.adjustment.post',
    read: [
      'stock.adjustment.prepare',
      'stock.adjustment.post',
      'inventory.read',
    ],
  },
  SALES_RETURN: {
    path: '/sales-returns',
    title: 'Phiếu trả hàng',
    prepare: 'returns.prepare',
    post: 'returns.post',
    read: ['returns.prepare', 'returns.post', 'debt.read', 'sales.read'],
  },
  PAYMENT_RECEIPT: {
    path: '/payment-receipts',
    title: 'Phiếu thu tiền',
    prepare: 'cash.receipt.prepare',
    post: 'cash.receipt.post',
    read: ['cash.receipt.prepare', 'cash.receipt.post', 'debt.read'],
  },
  CREDIT_APPLICATION: {
    path: '/credit-applications',
    title: 'Bù trừ dư có',
    prepare: 'credit.apply',
    post: 'credit.apply',
    read: ['credit.apply', 'debt.read'],
  },
  REFUND: {
    path: '/refunds',
    title: 'Hoàn tiền',
    prepare: 'cash.refund.prepare',
    post: 'cash.refund.post',
    read: ['cash.refund.prepare', 'cash.refund.post', 'debt.read'],
  },
} as const
export type DocumentKind = keyof typeof documentKinds
export type GoodsKind =
  'STOCK_RECEIPT' | 'STOCK_ISSUE' | 'STOCK_ADJUSTMENT' | 'SALES_RETURN'
export type PermissionCheck = (
  permission: FunctionCode | FunctionCode[],
) => boolean
export interface Page<T> {
  items: T[]
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
}
export interface DocumentSummary {
  id: string
  code: string
  kind: DocumentKind
  status: 'DRAFT' | 'PENDING' | 'POSTED' | 'CANCELLED'
  agencyId: string | null
  agencyName: string | null
  originDocumentId: string | null
  receiptType: string | null
  revisionNo: number
  businessDate: string
  totalAmount: string
  immediatePayment: string
}
export interface DocumentLine {
  id: string
  productId: string
  productName: string
  unitName: string
  quantity: string
  unitPrice: string
  lineAmount: string
  originLineId: string | null
  basePurchasePrice: string | null
  returnAmount: string | null
}
export interface Revision {
  id: string
  documentId: string
  revisionNo: number
  state: 'DRAFT' | 'READY' | 'POSTED'
  businessDate: string
  totalAmount: string
  immediatePayment: string
  sellingPriceRate: string | null
  paymentMethod: string | null
  agencySnapshot: {
    name: string
    address: string | null
    phone: string | null
    email: string
  } | null
  reason: string | null
  note: string | null
  createdAt: string
  lines: DocumentLine[]
}
export interface DocumentDetail {
  id: string
  code: string
  kind: DocumentKind
  status: DocumentSummary['status']
  agencyId: string | null
  originDocumentId: string | null
  receiptType: string | null
  currentRevision: Revision
  stockCountId?: string | null
  upfrontConfirmationId?: string | null
  autoReceiptId?: string | null
  remainingAtIssue?: string
  invoiceBalance?: { outstandingAmount: string } | null
  debtReducedAmount?: string
  creditCreatedAmount?: string
}

export const exact = {
  id: /^[1-9][0-9]{0,18}$/,
  money: /^(0|[1-9][0-9]{0,17})$/,
  positiveMoney: /^[1-9][0-9]{0,17}$/,
  quantity: /^(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$/,
  signedQuantity: /^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$/,
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
    throw new Error('Phản hồi máy chủ không hợp lệ.')
  return value as Record<string, unknown>
}
function numeric(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string' || !pattern.test(value))
    throw new Error('Giá trị số từ máy chủ không hợp lệ.')
}
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
    throw new Error('Phân trang máy chủ không hợp lệ.')
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
    typeof row.kind !== 'string' ||
    !Object.hasOwn(documentKinds, row.kind) ||
    !['DRAFT', 'PENDING', 'POSTED', 'CANCELLED'].includes(String(row.status)) ||
    !validDate(row.businessDate) ||
    !Number.isInteger(row.revisionNo) ||
    (row.revisionNo as number) < 1
  )
    throw new Error('Tóm tắt chứng từ không hợp lệ.')
  numeric(row.totalAmount, exact.money)
  numeric(row.immediatePayment, exact.money)
  return row as unknown as DocumentSummary
}
export function parseLine(value: unknown): DocumentLine {
  const row = object(value)
  if (
    !validId(row.id) ||
    !validId(row.productId) ||
    typeof row.productName !== 'string' ||
    typeof row.unitName !== 'string' ||
    !(row.originLineId === null || validId(row.originLineId))
  )
    throw new Error('Dòng chứng từ không hợp lệ.')
  numeric(row.quantity, exact.signedQuantity)
  numeric(row.unitPrice, exact.money)
  numeric(row.lineAmount, exact.money)
  if (isZero(String(row.quantity)))
    throw new Error('Số lượng dòng không hợp lệ.')
  return row as unknown as DocumentLine
}
export function parseRevision(value: unknown): Revision {
  const row = object(value)
  if (
    !validId(row.id) ||
    !validId(row.documentId) ||
    !Number.isInteger(row.revisionNo) ||
    (row.revisionNo as number) < 1 ||
    !['DRAFT', 'READY', 'POSTED'].includes(String(row.state)) ||
    !validDate(row.businessDate) ||
    !Array.isArray(row.lines) ||
    typeof row.createdAt !== 'string'
  )
    throw new Error('Phiên bản chứng từ không hợp lệ.')
  numeric(row.totalAmount, exact.money)
  numeric(row.immediatePayment, exact.money)
  return { ...row, lines: row.lines.map(parseLine) } as unknown as Revision
}
export function parseDocument(value: unknown): DocumentDetail {
  const row = object(value),
    revision = parseRevision(row.currentRevision)
  parseSummary({
    ...row,
    businessDate: revision.businessDate,
    totalAmount: revision.totalAmount,
    immediatePayment: revision.immediatePayment,
    revisionNo: revision.revisionNo,
  })
  if (revision.documentId !== row.id)
    throw new Error('Phiên bản không thuộc chứng từ.')
  return { ...row, currentRevision: revision } as unknown as DocumentDetail
}
export function canReadKind(kind: DocumentKind, has: PermissionCheck) {
  return documentKinds[kind].read.some((grant) => has(grant))
}
export function canChange(
  doc: DocumentDetail,
  mode: 'correct' | 'cancel',
  has: PermissionCheck,
) {
  if (
    doc.kind === 'REFUND' ||
    doc.status === 'CANCELLED' ||
    (mode === 'correct' && doc.status !== 'POSTED')
  )
    return false
  if (doc.kind === 'STOCK_ADJUSTMENT' && doc.stockCountId !== null) return false
  if (
    doc.kind === 'PAYMENT_RECEIPT' &&
    (doc.receiptType !== 'DEBT_COLLECTION' ||
      !['CASH', 'BANK_TRANSFER'].includes(
        doc.currentRevision.paymentMethod ?? '',
      ))
  )
    return false
  if (mode === 'correct')
    return has('documents.correct') && has(documentKinds[doc.kind].post)
  if (!has('documents.cancel')) return false
  // The detail exposes evidence identity, not its live state. The server rechecks it.
  if (
    doc.kind === 'STOCK_ISSUE' &&
    (doc.upfrontConfirmationId != null || doc.autoReceiptId != null) &&
    !has('cash.receipt.post')
  )
    return false
  return true
}

export interface LineInput {
  productId: string
  originLineId: string
  quantity: string
  unitPrice: string
  basePurchasePrice?: string
}
export function inputLines(
  kind: GoodsKind,
  lines: LineInput[],
  correction = false,
) {
  if (!lines.length) throw new Error('Cần ít nhất một dòng hàng.')
  const seen = new Set<string>()
  return lines.map((line) => {
    const id = kind === 'SALES_RETURN' ? line.originLineId : line.productId
    if (!validId(id) || seen.has(id))
      throw new Error('Mã dòng/mặt hàng không hợp lệ hoặc trùng lặp.')
    seen.add(id)
    const pattern =
      kind === 'STOCK_ADJUSTMENT' ? exact.signedQuantity : exact.quantity
    if (
      !pattern.test(line.quantity) ||
      isZero(line.quantity) ||
      (kind !== 'STOCK_ADJUSTMENT' && line.quantity.startsWith('-'))
    )
      throw new Error(
        'Số lượng phải là chuỗi thập phân hợp lệ, khác 0, tối đa 3 chữ số lẻ.',
      )
    if (kind === 'SALES_RETURN')
      return { originLineId: id, quantity: line.quantity }
    if (kind === 'STOCK_RECEIPT') {
      if (!exact.positiveMoney.test(line.unitPrice))
        throw new Error(
          'Giá nhập phải là số nguyên VNĐ dương, tối đa 18 chữ số.',
        )
      return {
        productId: id,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      }
    }
    if (kind === 'STOCK_ISSUE' && correction && line.basePurchasePrice) {
      if (!exact.positiveMoney.test(line.basePurchasePrice))
        throw new Error('Giá vốn không hợp lệ.')
      return {
        productId: id,
        quantity: line.quantity,
        basePurchasePrice: line.basePurchasePrice,
      }
    }
    return { productId: id, quantity: line.quantity }
  })
}
export function replacementBody(
  doc: DocumentDetail,
  values: {
    businessDate: string
    reason: string
    note: string
    lines: LineInput[]
    amount: string
    paymentMethod: string
  },
) {
  if (!validDate(values.businessDate) || !values.reason.trim())
    throw new Error('Cần ngày nghiệp vụ hợp lệ và lý do.')
  const header = {
    businessDate: values.businessDate,
    reason: values.reason.trim(),
    note: values.note || null,
  }
  if (doc.kind === 'PAYMENT_RECEIPT' || doc.kind === 'CREDIT_APPLICATION') {
    if (!exact.positiveMoney.test(values.amount))
      throw new Error('Số tiền phải là chuỗi số nguyên VNĐ dương.')
    if (doc.kind === 'PAYMENT_RECEIPT') {
      if (!['CASH', 'BANK_TRANSFER'].includes(values.paymentMethod))
        throw new Error('Chỉ sửa phiếu thu thủ công.')
      return {
        ...header,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
      }
    }
    return { ...header, amount: values.amount }
  }
  if (doc.kind === 'REFUND')
    throw new Error('Không hỗ trợ sửa phiếu hoàn tiền.')
  return {
    ...header,
    ...(doc.kind === 'STOCK_ISSUE' && doc.currentRevision.sellingPriceRate
      ? { sellingPriceRate: doc.currentRevision.sellingPriceRate }
      : {}),
    lines: inputLines(doc.kind, values.lines, true),
  }
}
