import { formatQuantity, formatVND } from '../../lib/formatters'
import { wardKindLabel } from '../../lib/labels'
import { t } from '@/lib/i18n/core'

/** List resources the picker can search through `GET /{resource}?q=&limit=`. */
export type PickerResource =
  | 'agencies'
  | 'products'
  | 'agency-types'
  | 'user-groups'
  | 'stock-issues'
  | 'payment-receipts'
  | 'wards'

export interface PickerItem {
  id: string
  label: string
  detail?: string
}

export type Raw = Record<string, unknown>

function text(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined
}

/** Presentation of one list row; returns null for rows without an id. */
export function describeItem(
  resource: PickerResource,
  raw: unknown,
): PickerItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Raw
  const id = text(row.id)
  if (!id) return null
  const code = text(row.code)
  const name = text(row.name) ?? text(row.fullName)
  const agency = text(row.agencyName)
  let label = code && name ? `${code} — ${name}` : (code ?? name ?? `#${id}`)
  let detail: string | undefined
  if (resource === 'products') {
    const stock = text(row.stock)
    if (stock !== undefined)
      detail = t('Tồn {stock} {text}', {
        stock: formatQuantity(stock),
        text: text(row.unitName) ?? '',
      }).trim()
  } else if (resource === 'agencies') {
    const debt = text(row.debt)
    if (debt !== undefined)
      detail = t('Nợ hiện tại {debt}', { debt: formatVND(debt) })
  } else if (resource === 'wards') {
    // Ward names already carry their kind ("Phường …", "Xã …", "Đặc khu …").
    label = name ?? code ?? `#${id}`
    const kind = text(row.kind)
    detail =
      [kind && wardKindLabel(kind), code && t('Mã {code}', { code })]
        .filter(Boolean)
        .join(' · ') || undefined
  } else if (resource === 'stock-issues' || resource === 'payment-receipts') {
    if (code && agency) label = `${code} — ${agency}`
    const amount = text(row.totalAmount) ?? text(row.amount)
    if (amount !== undefined) detail = formatVND(amount)
  }
  return { id, label, detail }
}

export function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && data !== null) {
    const items = (data as Raw).items
    if (Array.isArray(items)) return items
  }
  return []
}
