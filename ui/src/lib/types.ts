export type FunctionCode =
  | 'users.manage'
  | 'groups.manage'
  | 'permissions.manage'
  | 'rules.manage'
  | 'agency_type.manage'
  | 'unit.manage'
  | 'product.manage'
  | 'agency.read'
  | 'agency.manage'
  | 'stock.receipt.prepare'
  | 'stock.receipt.post'
  | 'stock.issue.prepare'
  | 'stock.issue.post'
  | 'cash.receipt.prepare'
  | 'cash.receipt.post'
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
/** Administrative kind of a Ho Chi Minh City ward/commune (2025 reform). */
export type WardKind = 'WARD' | 'COMMUNE' | 'SPECIAL_ZONE'

/** Read-only ward/commune reference row (`GET /wards`). */
export interface Ward {
  id: number
  code: string
  name: string
  kind: WardKind
  /** Capacity view under the "max agencies per ward" rule (server-computed). */
  activeAgencyCount?: number
  maxAgencies?: number
  remainingSlots?: number
  createdAt?: string
  updatedAt?: string
}

/** `AgencyTypeResponse`: `maxDebt` is the debt limit of each agency of the type. */
export interface AgencyType {
  id: number
  code: string
  name: string
  maxDebt: string
  status: 'ACTIVE' | 'INACTIVE'
  agencyCount?: number
  activeAgencyCount?: number
  createdAt?: string
  updatedAt?: string
}

/** `UnitResponse`. */
export interface Unit {
  id: number
  code: string
  name: string
  allowsFraction: boolean
  status: 'ACTIVE' | 'INACTIVE'
  productCount?: number
  createdAt?: string
  updatedAt?: string
}

/** `BusinessRuleResponse` (QĐ1 ward capacity, QĐ2 selling-price rate). */
export interface BusinessRules {
  maxAgenciesPerWard: number
  sellingPriceRate: string
  createdAt?: string
  updatedAt?: string
}

/**
 * `ProductResponse`. `stock`, `lastPurchasePrice` and `sellingPrice` are
 * server-computed; both prices stay `null` until the first posted receipt.
 */
export interface Product {
  id: string
  code: string
  name: string
  unitId: number
  unitName: string
  allowsFraction: boolean
  status: 'ACTIVE' | 'INACTIVE'
  stock: string
  lastPurchasePrice: string | null
  sellingPrice: string | null
  createdAt?: string
  updatedAt?: string
}

/**
 * `AgencyResponse`. `debt` is the current debt (negative only after a late
 * verified online payment); `maxDebt` comes from the agency type and
 * `remainingCreditLimit` = maxDebt − debt.
 */
export interface Agency {
  id: string
  code: string
  name: string
  typeId: number
  typeName: string
  wardId: number
  wardName: string
  phone: string | null
  email: string | null
  address: string | null
  acceptedDate: string
  status: 'ACTIVE' | 'TERMINATED'
  terminatedAt: string | null
  terminationReason: string | null
  debt: string
  maxDebt: string
  remainingCreditLimit: string
  createdBy?: string | null
  updatedBy?: string | null
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

export interface ChatbotMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  data?: unknown
  suggestions?: string[]
}
