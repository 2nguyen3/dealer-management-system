/**
 * Types and runtime validation for `POST /chatbot/messages` (sendChatbotMessage).
 * Source of truth: openwiki/backend-design/API/openapi.json and
 * openwiki/backend-design/plan/chatbot/CONTRACT.md. The backend answers with an LLM
 * that uses the tools of the Agentra MCP server (`mcp-server/`); every table is
 * copied from a tool result.
 */
import type { FunctionCode } from '@/lib/types'

export type ChatbotColumnType =
  | 'code'
  | 'text'
  | 'money'
  | 'quantity'
  | 'integer'
  | 'rate'
  | 'date'
  | 'status'
  | 'kind'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatbotMessageRequest {
  messages: ChatTurn[]
  locale?: string
}

export type ChatbotCell = string | number | null

export interface ChatbotTable {
  title: string
  /** MCP tool that produced the rows, e.g. `list_agencies`. */
  tool: string
  columns: { key: string; type: ChatbotColumnType }[]
  rows: Record<string, ChatbotCell>[]
  totalRows: number
  truncated: boolean
  asOf: string
}

export interface ChatbotReply {
  answer: string
  tables: ChatbotTable[]
  /** MCP tools called for this answer, in call order. */
  tools: string[]
  model?: string | null
}

/** Contract limits mirrored on the client. */
export const MAX_TURNS = 20
export const MAX_TURN_LENGTH = 2000

/**
 * Users who can read at least one kind of business data see the assistant; the
 * MCP server hides the tools a user cannot call.
 */
export const ASSISTANT_PERMISSIONS: FunctionCode[] = [
  'agency.read',
  'debt.read',
  'sales.read',
  'reports.read',
  'product.manage',
  'stock.receipt.prepare',
  'stock.receipt.post',
  'stock.issue.prepare',
  'stock.issue.post',
  'cash.receipt.prepare',
  'cash.receipt.post',
]

/** Product readers (same policy as /products). */
export const INVENTORY_PERMISSIONS: FunctionCode[] = [
  'product.manage',
  'stock.receipt.prepare',
  'stock.receipt.post',
  'stock.issue.prepare',
  'stock.issue.post',
  'sales.read',
  'reports.read',
]

/** UI route that shows the same data as a table's MCP tool. */
export const SOURCE_ROUTES: Record<string, string> = {
  list_agencies: '/agencies',
  list_products: '/products',
  search_documents: '/document-history',
  list_stock_issues: '/stock-issues',
  list_stock_receipts: '/stock-receipts',
  list_payment_receipts: '/payment-receipts',
  get_sales_report: '/reports',
  get_product_sales_report: '/reports',
  get_debt_report: '/reports',
  get_inventory_report: '/reports',
  get_collections_report: '/reports',
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown, max = 4000): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max
const oneOf = <T extends string>(
  value: unknown,
  options: readonly T[],
): value is T => typeof value === 'string' && options.includes(value as T)

const COLUMN_TYPES = [
  'code',
  'text',
  'money',
  'quantity',
  'integer',
  'rate',
  'date',
  'status',
  'kind',
] as const

function isCell(value: unknown): value is ChatbotCell {
  return (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isInteger(value))
  )
}

function isTable(value: unknown): value is ChatbotTable {
  if (!isObject(value) || typeof value.title !== 'string') return false
  if (typeof value.tool !== 'string' || !/^[a-z_]+$/.test(value.tool))
    return false
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
  return (
    Number.isInteger(value.totalRows) &&
    (value.totalRows as number) >= 0 &&
    typeof value.truncated === 'boolean' &&
    typeof value.asOf === 'string' &&
    !Number.isNaN(Date.parse(value.asOf))
  )
}

/** Validates an untrusted response body; `null` when it breaks the contract. */
export function parseChatbotReply(data: unknown): ChatbotReply | null {
  if (!isObject(data) || !isText(data.answer, 2000)) return null
  if (
    !Array.isArray(data.tables) ||
    data.tables.length > 3 ||
    !data.tables.every(isTable)
  )
    return null
  if (
    !Array.isArray(data.tools) ||
    !data.tools.every((tool) => typeof tool === 'string')
  )
    return null
  if (
    data.model !== undefined &&
    data.model !== null &&
    typeof data.model !== 'string'
  )
    return null
  return data as unknown as ChatbotReply
}
