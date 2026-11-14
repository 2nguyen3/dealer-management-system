import { apiFetch } from '../../lib/api'
import { WARD_KIND_LABELS } from '../../lib/labels'
import type { Ward, WardKind } from '../../lib/types'
import {
  catalog,
  page,
  queryPath,
  record,
  text,
  type Page,
} from '../payment_receipts/contracts'
import { t } from '@/lib/i18n/core'

export { WARD_KIND_LABELS, wardKindLabel } from '../../lib/labels'

export const WARD_KINDS = Object.keys(WARD_KIND_LABELS) as WardKind[]

/** Contract sort values of `GET /wards` (prefix "-" = descending). */
export type WardSort = 'id' | '-id' | 'code' | '-code' | 'name' | '-name'

export interface WardListQuery {
  q?: string
  code?: string
  kind?: WardKind
  sort?: WardSort
  /** 1–100 (contract bound); defaults to the server's 25 when omitted. */
  limit?: number
  cursor?: string
}

export function isWardKind(value: unknown): value is WardKind {
  return typeof value === 'string' && Object.hasOwn(WARD_KIND_LABELS, value)
}

/** Validates one read-only ward row from the server. */
export function ward(value: unknown): Ward {
  const data = record(value)
  const kind = data.kind
  if (!isWardKind(kind)) throw new Error('Invalid ward kind')
  const result: Ward = {
    id: catalog(data.id),
    code: text(data.code),
    name: text(data.name),
    kind,
  }
  for (const key of [
    'activeAgencyCount',
    'maxAgencies',
    'remainingSlots',
  ] as const) {
    const count = data[key]
    if (count === undefined) continue
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0)
      throw new Error(`Invalid ward ${key}`)
    result[key] = count
  }
  if (data.createdAt !== undefined) result.createdAt = text(data.createdAt)
  if (data.updatedAt !== undefined) result.updatedAt = text(data.updatedAt)
  return result
}

/** Query string of a ward list request; rejects out-of-contract values. */
export function wardListPath(query: WardListQuery = {}): string {
  const { limit, kind, q } = query
  if (
    limit !== undefined &&
    (!Number.isInteger(limit) || limit < 1 || limit > 100)
  )
    throw new Error(t('Số dòng mỗi trang phải từ 1 đến 100.'))
  if (kind !== undefined && !isWardKind(kind))
    throw new Error(t('Loại đơn vị hành chính không hợp lệ.'))
  return queryPath('/wards', {
    q: q?.trim() ?? '',
    code: query.code?.trim() ?? '',
    kind: kind ?? '',
    sort: query.sort ?? '',
    limit: limit === undefined ? '' : String(limit),
    cursor: query.cursor ?? '',
  })
}

/** One page of `GET /wards` (read-only catalogue of 168 HCMC wards/communes). */
export async function listWards(
  query: WardListQuery = {},
  signal?: AbortSignal,
): Promise<Page<Ward>> {
  const response = await apiFetch<unknown>(wardListPath(query), { signal })
  return page(response.data, ward)
}

/** `GET /wards/{wardId}` with its ETag. */
export async function getWard(
  wardId: number | string,
  signal?: AbortSignal,
): Promise<{ ward: Ward; etag: string | null }> {
  const response = await apiFetch<unknown>(
    `/wards/${encodeURIComponent(String(catalog(wardId)))}`,
    { signal },
  )
  return { ward: ward(response.data), etag: response.etag }
}

/** Upper bound of pages read by {@link listAllWards} (168 wards = 2 pages of 100). */
export const MAX_WARD_PAGES = 5

/** Every ward of the catalogue, following cursors (bounded by MAX_WARD_PAGES). */
export async function listAllWards(signal?: AbortSignal): Promise<Ward[]> {
  const items: Ward[] = []
  let cursor: string | undefined
  for (let index = 0; index < MAX_WARD_PAGES; index += 1) {
    const result = await listWards({ limit: 100, cursor }, signal)
    items.push(...result.items)
    const next = result.pagination.nextCursor
    if (!result.pagination.hasMore || !next) return items
    cursor = next
  }
  throw new Error(t('Danh mục phường/xã vượt quá số trang cho phép.'))
}
