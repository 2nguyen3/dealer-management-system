/**
 * Types and runtime validation for `POST /chatbot/messages` (sendChatbotMessage).
 * Source of truth: openwiki/backend-design/plan/chatbot/chatbot.openapi.yaml and
 * CONTRACT.md. The operation joins API/openapi.json once the backend router exists.
 */
import type { FunctionCode } from '@/lib/types'

export type ChatbotMetric = 'DEBT' | 'INVENTORY' | 'SALES'
export type ChatbotEntity = 'agency' | 'product'
export type ChatbotColumnType =
  'code' | 'text' | 'money' | 'quantity' | 'integer' | 'rate'
export type ChatbotMissing = 'metric' | 'period' | 'agency' | 'product'
export type ChatbotRefusal =
  'UNSUPPORTED_QUERY' | 'FORBIDDEN_METRIC' | 'NO_MATCH'
export type ChatbotSourceOperation =
  | 'listAgencies'
  | 'listProducts'
  | 'getDebtReport'
  | 'getInventoryReport'
  | 'getSalesReport'
  | 'getProductSalesReport'

export interface SemanticFilter {
  field: string
  op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string
}

/** The engine's normalized query; sent back untouched in `resume`. */
export interface SemanticQuery {
  metric: ChatbotMetric
  groupBy?: 'agency' | 'product'
  period?: { fromDate: string; toDate: string }
  filters: SemanticFilter[]
  sort?: string
  limit: number
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatbotMessageRequest {
  messages: ChatTurn[]
  resume?: {
    query: SemanticQuery
    select: { entity: ChatbotEntity; code: string }
  }
  locale?: string
}

export type ChatbotCell = string | number | null

export interface ChatbotTable {
  title: string
  understood: SemanticQuery
  columns: { key: string; type: ChatbotColumnType }[]
  rows: Record<string, ChatbotCell>[]
  totalRows: number
  truncated: boolean
  asOf: string
  source: { operationId: ChatbotSourceOperation; query: Record<string, string> }
}

export interface ChatbotCandidate {
  code: string
  name: string
  detail: string | null
}

export type ChatbotReply =
  | {
      status: 'ANSWERED'
      answer: string
      tables: ChatbotTable[]
      model?: string | null
    }
  | {
      status: 'NEEDS_SELECTION'
      answer: string
      entity: ChatbotEntity
      candidates: ChatbotCandidate[]
      totalMatches: number
      pendingQuery: SemanticQuery
    }
  | { status: 'NEEDS_INFO'; answer: string; missing: ChatbotMissing[] }
  | { status: 'REFUSED'; answer: string; reason: ChatbotRefusal }

/** Contract limits mirrored on the client. */
export const MAX_TURNS = 20
export const MAX_TURN_LENGTH = 2000

/**
 * Union of the metric permissions (the endpoint's anyOf): users without any of
 * them never see the assistant.
 */
export const ASSISTANT_PERMISSIONS: FunctionCode[] = [
  'debt.read',
  'sales.read',
  'reports.read',
  'product.manage',
  'stock.receipt.prepare',
  'stock.receipt.post',
  'stock.issue.prepare',
  'stock.issue.post',
]

/** Product readers: current INVENTORY questions (same policy as /products). */
export const INVENTORY_PERMISSIONS: FunctionCode[] = [
  'product.manage',
  'stock.receipt.prepare',
  'stock.receipt.post',
  'stock.issue.prepare',
  'stock.issue.post',
  'sales.read',
  'reports.read',
]

/** UI route that shows the same figures as a table's source operation. */
export const SOURCE_ROUTES: Record<ChatbotSourceOperation, string> = {
  listAgencies: '/agencies',
  listProducts: '/products',
  getDebtReport: '/reports',
  getInventoryReport: '/reports',
  getSalesReport: '/reports',
  getProductSalesReport: '/reports',
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown, max = 4000): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const oneOf = <T extends string>(
  value: unknown,
  options: readonly T[],
): value is T => typeof value === 'string' && options.includes(value as T)

const METRICS = ['DEBT', 'INVENTORY', 'SALES'] as const
const OPS = ['eq', 'gt', 'gte', 'lt', 'lte'] as const
const COLUMN_TYPES = [
  'code',
  'text',
  'money',
  'quantity',
  'integer',
  'rate',
] as const
const MISSING = ['metric', 'period', 'agency', 'product'] as const
const REASONS = ['UNSUPPORTED_QUERY', 'FORBIDDEN_METRIC', 'NO_MATCH'] as const
const ENTITIES = ['agency', 'product'] as const

export function isSemanticQuery(value: unknown): value is SemanticQuery {
  if (!isObject(value) || !oneOf(value.metric, METRICS)) return false
  if (value.groupBy !== undefined && !oneOf(value.groupBy, ENTITIES))
    return false
  if (value.period !== undefined) {
    if (!isObject(value.period)) return false
    if (!isDate(value.period.fromDate) || !isDate(value.period.toDate))
      return false
  }
  if (value.sort !== undefined && !/^-?[A-Za-z]+$/.test(String(value.sort)))
    return false
  if (
    !Number.isInteger(value.limit) ||
    (value.limit as number) < 1 ||
    (value.limit as number) > 50
  )
    return false
  return (
    Array.isArray(value.filters) &&
    value.filters.length <= 5 &&
    value.filters.every(
      (filter) =>
        isObject(filter) &&
        typeof filter.field === 'string' &&
        /^[A-Za-z]+$/.test(filter.field) &&
        oneOf(filter.op, OPS) &&
        isText(filter.value, 120),
    )
  )
}

function isCell(value: unknown): value is ChatbotCell {
  return (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isInteger(value))
  )
}

function isTable(value: unknown): value is ChatbotTable {
  if (!isObject(value) || typeof value.title !== 'string') return false
  if (!isSemanticQuery(value.understood)) return false
  if (
    !Array.isArray(value.columns) ||
    value.columns.length === 0 ||
    !value.columns.every(
      (column) =>
        isObject(column) &&
        typeof column.key === 'string' &&
        /^[A-Za-z]+$/.test(column.key) &&
        oneOf(column.type, COLUMN_TYPES),
    )
  )
    return false
  if (
    !Array.isArray(value.rows) ||
    value.rows.length > 50 ||
    !value.rows.every(
      (row) => isObject(row) && Object.values(row).every(isCell),
    )
  )
    return false
  if (!isObject(value.source) || !isObject(value.source.query)) return false
  if (!oneOf(value.source.operationId, Object.keys(SOURCE_ROUTES))) return false
  if (!Object.values(value.source.query).every((v) => typeof v === 'string'))
    return false
  return (
    Number.isInteger(value.totalRows) &&
    (value.totalRows as number) >= 0 &&
    typeof value.truncated === 'boolean' &&
    typeof value.asOf === 'string' &&
    !Number.isNaN(Date.parse(value.asOf))
  )
}

function isCandidate(value: unknown): value is ChatbotCandidate {
  return (
    isObject(value) &&
    isText(value.code, 64) &&
    isText(value.name, 400) &&
    (value.detail === null || typeof value.detail === 'string')
  )
}

/** Validates an untrusted response body; `null` when it breaks the contract. */
export function parseChatbotReply(data: unknown): ChatbotReply | null {
  if (!isObject(data) || !isText(data.answer, 2000)) return null
  switch (data.status) {
    case 'ANSWERED':
      return Array.isArray(data.tables) &&
        data.tables.length >= 1 &&
        data.tables.length <= 3 &&
        data.tables.every(isTable) &&
        (data.model === undefined ||
          data.model === null ||
          typeof data.model === 'string')
        ? (data as ChatbotReply)
        : null
    case 'NEEDS_SELECTION':
      return oneOf(data.entity, ENTITIES) &&
        Array.isArray(data.candidates) &&
        data.candidates.length >= 2 &&
        data.candidates.length <= 10 &&
        data.candidates.every(isCandidate) &&
        Number.isInteger(data.totalMatches) &&
        isSemanticQuery(data.pendingQuery)
        ? (data as ChatbotReply)
        : null
    case 'NEEDS_INFO':
      return Array.isArray(data.missing) &&
        data.missing.length > 0 &&
        data.missing.every((item) => oneOf(item, MISSING))
        ? (data as ChatbotReply)
        : null
    case 'REFUSED':
      return oneOf(data.reason, REASONS) ? (data as ChatbotReply) : null
    default:
      return null
  }
}
