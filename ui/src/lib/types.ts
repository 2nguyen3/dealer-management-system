export type FunctionCode =
  | 'users.manage'
  | 'groups.manage'
  | 'permissions.manage'
  | 'rules.manage'
  | 'district.manage'
  | 'agency_type.manage'
  | 'unit.manage'
  | 'product.manage'
  | 'agency.read'
  | 'agency.manage'
  | 'inventory.read'
  | 'stock.receipt.prepare'
  | 'stock.receipt.post'
  | 'stock.issue.prepare'
  | 'stock.issue.post'
  | 'cash.receipt.prepare'
  | 'cash.receipt.post'
  | 'cash.upfront.verify'
  | 'stock.count'
  | 'stock.adjustment.prepare'
  | 'stock.adjustment.post'
  | 'returns.prepare'
  | 'returns.post'
  | 'cash.refund.prepare'
  | 'cash.refund.post'
  | 'credit.apply'
  | 'documents.correct'
  | 'documents.cancel'
  | 'sales.read'
  | 'debt.read'
  | 'reports.read'
  | 'audit.read'
  | 'payments.online'

export interface UserResponse {
  id: string
  fullName: string
  email: string
  groupId: number
  groupCode: string
  groupName: string
  status: 'ACTIVE' | 'LOCKED'
  createdAt: string
  updatedAt: string
}

export interface TokenResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
  refreshToken: string
  refreshExpiresAt: string
  user: UserResponse
}

export interface CurrentUser {
  user: UserResponse
  allowedFunctions: FunctionCode[]
}

export interface ApiErrorPayload {
  code: string
  message: string
  requestId?: string
  fieldErrors?: Record<string, string>
}

export interface CursorPaginationParams {
  limit?: number
  cursor?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  nextCursor?: string | null
  hasMore?: boolean
}

// Master Data Types
export interface District {
  id: number
  name: string
  activeAgenciesCount?: number
  status: 'ACTIVE' | 'INACTIVE'
  createdAt?: string
  updatedAt?: string
}

export interface AgencyType {
  id: number
  name: string
  maxDebt: string
  activeAgenciesCount?: number
  status: 'ACTIVE' | 'INACTIVE'
  createdAt?: string
  updatedAt?: string
}

export interface Unit {
  id: number
  name: string
  allowFraction: boolean
  status: 'ACTIVE' | 'INACTIVE'
  createdAt?: string
  updatedAt?: string
}

export interface BusinessRules {
  maxAgenciesPerDistrict: number
  maxAgencyTypesCount: number
  maxUnitsCount: number
  priceMultiplier: string
  allowDebtExceedLimit: boolean
  updatedAt?: string
}

export interface Product {
  id: string
  code: string
  name: string
  unitId: number
  unitName?: string
  currentStock: string
  purchasePrice?: string
  currentPurchasePrice?: string
  sellingPrice?: string
  currentSellingPrice?: string
  minStockAlert?: string
  maxStockAlert?: string
  lowStockThreshold?: string
  status: 'ACTIVE' | 'DISCONTINUED'
  createdAt?: string
  updatedAt?: string
}

export interface Agency {
  id: string
  code: string
  name: string
  phone: string
  email?: string
  address: string
  districtId: number
  districtName?: string
  agencyTypeId?: number
  typeId?: number
  agencyTypeName?: string
  typeName?: string
  receptionDate?: string
  acceptedDate?: string
  status: 'ACTIVE' | 'TERMINATED'
  currentDebt: string
  currentCredit?: string
  maxDebt?: string
  remainingCreditLimit?: string
  terminationReason?: string
  terminatedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface UserGroup {
  id: number
  code: string
  name: string
  description?: string
  userCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface AppUser {
  id: string
  fullName: string
  email: string
  groupId: number
  groupName?: string
  groupCode?: string
  status: 'ACTIVE' | 'LOCKED'
  createdAt?: string
  updatedAt?: string
}

export interface FunctionItem {
  code: FunctionCode
  name: string
  description?: string
  group?: string
}

export interface GroupPermission {
  functionCode: FunctionCode
  granted: boolean
}

export interface AuditLog {
  id: string
  actorId?: string
  actorName?: string
  action: string
  entityType: string
  entityId?: string
  changes?: Record<string, { before: unknown; after: unknown }>
  createdAt: string
  requestId?: string
}

export interface InventoryEntry {
  id: string
  productId: string
  documentDate?: string
  businessDate?: string
  documentType: string
  documentId: string
  documentCode?: string
  quantityDelta: string
  balanceAfter: string
  unitPrice?: string
  reference?: string
  createdAt: string
}

export interface DocumentLine {
  id?: string
  productId: string
  productCode?: string
  productName?: string
  unitName?: string
  quantity: string
  unitPrice: string
  amount: string
}

export interface StockReceipt {
  id: string
  code: string
  documentDate?: string
  businessDate?: string
  supplierName?: string
  status: 'DRAFT' | 'POSTED' | 'CANCELED' | 'CANCELLED'
  totalAmount: string
  note?: string
  lines?: DocumentLine[]
  createdAt: string
  updatedAt?: string
}

export interface StockIssue {
  id: string
  code: string
  agencyId: string
  agencyName?: string
  documentDate?: string
  businessDate?: string
  status: 'DRAFT' | 'READY' | 'PENDING' | 'POSTED' | 'CANCELED' | 'CANCELLED'
  totalAmount: string
  upfrontRequired?: string
  upfrontPaid?: string
  remainingDebt?: string
  note?: string
  lines?: DocumentLine[]
  createdAt: string
  updatedAt?: string
}

export interface PaymentReceipt {
  id: string
  code: string
  agencyId: string
  agencyName?: string
  documentDate?: string
  businessDate?: string
  amount?: string
  totalAmount?: string
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'ONLINE'
  status: 'DRAFT' | 'POSTED' | 'CANCELED' | 'CANCELLED'
  note?: string
  allocations?: Array<{
    invoiceId: string
    invoiceCode: string
    amount: string
  }>
  createdAt: string
  updatedAt?: string
}

export interface UpfrontConfirmation {
  id: string
  stockIssueId: string
  stockIssueCode: string
  agencyId: string
  agencyName: string
  amount: string
  verified: boolean
  receivedSeparately: boolean
  createdAt: string
}

export interface AgencyBalance {
  agencyId: string
  agencyCode: string
  agencyName: string
  currentDebt: string
  maxDebt: string
  availableCredit: string
  reservedCredit: string
  earliestUnpaidInvoiceDate?: string
}

export interface InvoiceBalance {
  invoiceId: string
  invoiceCode: string
  documentDate: string
  totalAmount: string
  paidAmount: string
  remainingAmount: string
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
}

export interface StockAdjustment {
  id: string
  code: string
  documentDate?: string
  businessDate?: string
  reason: string
  status: 'DRAFT' | 'POSTED' | 'CANCELED' | 'CANCELLED'
  lines?: Array<{
    productId: string
    productCode?: string
    productName?: string
    quantityDelta: string
    unitName?: string
  }>
  createdAt: string
}

export interface StockCount {
  id: string
  code: string
  documentDate?: string
  countedAt?: string
  status?: string
  state?: string
  note?: string
  reason?: string
  lines?: Array<{
    productId: string
    productCode?: string
    productName?: string
    bookQuantity: string
    actualQuantity?: string
    countedQuantity?: string
    difference: string
  }>
  createdAt: string
}

export interface SalesReturn {
  id: string
  code: string
  agencyId: string
  agencyName?: string
  sourceInvoiceId?: string
  sourceInvoiceCode?: string
  originDocumentId?: string
  documentDate?: string
  businessDate?: string
  status: 'DRAFT' | 'POSTED' | 'CANCELED' | 'CANCELLED'
  totalAmount: string
  note?: string
  lines?: Array<{
    productId: string
    productCode?: string
    productName?: string
    quantity: string
    unitPrice: string
    amount: string
  }>
  createdAt: string
}

export interface CreditLot {
  id: string
  agencyId: string
  agencyName?: string
  originalAmount?: string
  balance?: string
  remainingAmount?: string
  reserved?: string
  reservedAmount?: string
  available?: string
  availableAmount?: string
  sourceDocumentType?: string
  sourceDocumentId?: string
  sourceDocumentCode?: string
  createdAt: string
}

export interface CreditApplication {
  id: string
  code: string
  kind?: string
  agencyId: string
  agencyName?: string
  status: 'DRAFT' | 'POSTED' | 'CANCELED' | 'CANCELLED'
  cashReceived?: string
  creditUsedAmount?: string
  totalAmount?: string
  businessDate?: string
  documentDate?: string
  note?: string
  createdAt?: string
  updatedAt?: string
  currentRevision?: {
    id: string
    documentId: string
    revisionNo: number
    state: string
    businessDate: string
    totalAmount: string
    note?: string
    agencySnapshot?: {
      name: string
      address?: string
      phone?: string
      email?: string
    }
  }
  allocations?: Array<{
    invoiceId: string
    invoiceCode?: string
    amount: string
  }>
}

export interface OnlinePayment {
  id: string
  paymentId?: string
  agencyId: string
  agencyName?: string
  provider: string
  merchantReference?: string
  providerTransactionId?: string | null
  amount: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
  expiresAt?: string
  paymentTime?: string | null
  receiptDocumentId?: string | null
  receiptDocumentCode?: string | null
  checkoutUrl?: string | null
  createdAt: string
  updatedAt?: string
  events?: Array<{
    id: string
    eventType: string
    payload?: string
    createdAt: string
  }>
}

export interface Refund {
  id: string
  code: string
  kind?: string
  agencyId: string
  agencyName?: string
  originDocumentId?: string
  originDocumentCode?: string
  amount?: string
  totalAmount?: string
  reservedAmount?: string
  refundedAmount?: string
  method?: 'CASH' | 'ONLINE' | 'BANK_TRANSFER' | string
  paymentMethod?: 'CASH' | 'ONLINE' | 'BANK_TRANSFER' | string
  status: 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'PAID' | 'CANCELED' | 'CANCELLED'
  latestAttemptId?: string | null
  latestAttemptState?: string | null
  reason?: string
  note?: string
  businessDate?: string
  documentDate?: string
  creditLotId?: string
  reservationId?: string
  createdAt: string
  updatedAt?: string
  currentRevision?: {
    id?: string
    documentId?: string
    revisionNo?: number
    state?: string
    businessDate?: string
    totalAmount?: string
    paymentMethod?: string
    reason?: string
    note?: string
    agencySnapshot?: {
      name?: string
      address?: string
      phone?: string
      email?: string
    }
  }
}

export interface DocumentHistoryItem {
  id: string
  code: string
  kind: string
  agencyId?: string
  agencyName?: string
  status: string
  businessDate?: string
  totalAmount?: string
  createdAt: string
  updatedAt?: string
  revisionCount?: number
}

export interface DocumentRevision {
  id: string
  documentId: string
  revisionNo: number
  state: string
  businessDate: string
  totalAmount: string
  note?: string
  reason?: string
  createdAt: string
  lines?: DocumentLine[]
}

export interface SalesReportItem {
  agencyId: string
  agencyCode: string
  agencyName: string
  salesCount: number
  totalRevenue: string
  salesRatio: string
}

export interface SalesReportResponse {
  month: number
  year: number
  totalRevenue: string
  items: SalesReportItem[]
}

export interface DebtReportItem {
  agencyId: string
  agencyCode: string
  agencyName: string
  openingDebt: string
  incurredDebt: string
  paidDebt: string
  closingDebt: string
}

export interface DebtReportResponse {
  month: number
  year: number
  totalClosingDebt: string
  items: DebtReportItem[]
}

export interface DashboardMetrics {
  totalAgencies: number
  activeAgencies: number
  totalProducts: number
  lowStockProducts: number
  monthRevenue: string
  totalDebt: string
  pendingOrdersCount?: number
  recentActivities?: Array<{
    id: string
    title: string
    timestamp: string
    type: string
  }>
  topAgencies?: Array<{
    id: string
    name: string
    revenue: string
    debt: string
  }>
}

export interface ChatbotMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  data?: unknown
  suggestions?: string[]
}
